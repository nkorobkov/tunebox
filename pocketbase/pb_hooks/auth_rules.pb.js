/// <reference path="../pb_data/types.d.ts" />

// Sign-in rules for `users` (see the 1784500000_users_otp_auth migration):
//
// - Accounts with a linked Google login are Google-only: code requests, password
//   sign-in and password-reset requests for them fail with a `use_google` error, which
//   the app turns into "This email uses Google sign-in". (This tells anyone whether an
//   address has a TuneBox Google account — accepted, for clearer sign-in.) A code
//   account that later signs in with Google gets linked by PB and becomes Google-only.
// - Code requests need a Turnstile token (body field `turnstileToken`) and double as
//   sign-up: an unknown address gets a new, unverified account with a random password,
//   then the code. Entering the code verifies it (authRule requires verified).
// - Accounts that never entered their code are deleted after a day.
//
// NOTE: handlers run in their own scope; shared code comes from auth_lib.js via require.

onRecordRequestOTPRequest((e) => {
    const lib = require(`${__hooks}/auth_lib.js`);
    const body = e.requestInfo().body;
    lib.checkTurnstile(e, body.turnstileToken);

    const email = String(body.email).trim();
    if (!e.record) {
        // PB looks the address up case-sensitively, but its unique index isn't: find
        // "Name@Example.com" when "name@example.com" is typed (and vice versa).
        try {
            e.record = e.app.findFirstRecordByFilter("users", "email:lower = {:email}", { email: email.toLowerCase() });
        } catch (_) { /* no such account */ }
    }

    if (e.record) {
        if (lib.googleLinked(e.app, e.record)) throw lib.useGoogle();
        if (!e.record.verified()) {
            // Not verified yet, so nobody has proven they own the address: make sure
            // no password set before that keeps working afterwards.
            e.record.setRandomPassword();
            e.app.save(e.record);
        }
    } else {
        const record = new Record(e.collection);
        record.setEmail(email.toLowerCase());
        record.setRandomPassword();
        record.setVerified(false);
        e.app.save(record);
        e.record = record;
    }
    e.next();
}, "users");

onRecordAuthWithPasswordRequest((e) => {
    const lib = require(`${__hooks}/auth_lib.js`);
    if (e.record && lib.googleLinked(e.app, e.record)) throw lib.useGoogle();
    e.next();
}, "users");

onRecordRequestPasswordResetRequest((e) => {
    const lib = require(`${__hooks}/auth_lib.js`);
    if (e.record && lib.googleLinked(e.app, e.record)) throw lib.useGoogle();
    e.next();
}, "users");

// Sign-ups that never entered their code (or addresses typed by someone else).
cronAdd("users_unverified_cleanup", "41 3 * * *", () => {
    const cutoff = new Date(Date.now() - 86400 * 1000).toISOString().replace("T", " ");
    let deleted = 0;
    for (;;) {
        const batch = $app.findRecordsByFilter(
            "users", "verified = false && created < {:cutoff}", "created", 200, 0, { cutoff: cutoff });
        if (!batch.length) break;
        for (const record of batch) {
            $app.delete(record);
            deleted++;
        }
    }
    if (deleted) $app.logger().info("unverified users cleanup", "deleted", deleted);
});
