/// <reference path="../pb_data/types.d.ts" />
// Helpers for auth_rules.pb.js. Hook handlers run in their own scope, so they load
// this with require(`${__hooks}/auth_lib.js`) instead of sharing top-level code.
// (Not named *.pb.js, so PocketBase doesn't load it as a hooks file itself.)

/** True when the account has a linked Google login. Such accounts sign in with Google only. */
function googleLinked(app, record) {
    return app.findAllExternalAuthsByRecord(record).some((a) => a.provider() === "google");
}

/** The error the sign-in dialog turns into "This email uses Google sign-in". */
function useGoogle() {
    return new BadRequestError("This email uses Google sign-in.", {
        email: new ValidationError("use_google", "This email uses Google sign-in."),
    });
}

function botCheckFailed(message) {
    return new BadRequestError(message, {
        turnstileToken: new ValidationError("turnstile_failed", message),
    });
}

/**
 * Verifies a Cloudflare Turnstile token with siteverify. Fails closed: with no
 * TURNSTILE_SECRET in the environment, codes can't be requested at all.
 * TURNSTILE_HOSTNAMES (comma separated), when set, limits where the widget may run.
 */
function checkTurnstile(e, token) {
    const secret = $os.getenv("TURNSTILE_SECRET");
    if (!secret) {
        e.app.logger().error("TURNSTILE_SECRET is not set: email codes are disabled");
        throw botCheckFailed("Email sign-in is unavailable right now.");
    }
    if (!token) throw botCheckFailed("The bot check didn't finish. Try again.");

    let data;
    try {
        const res = $http.send({
            url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "secret=" + encodeURIComponent(secret)
                + "&response=" + encodeURIComponent(token)
                + "&remoteip=" + encodeURIComponent(e.realIP()),
            timeout: 10,
        });
        data = res.statusCode === 200 ? res.json : null;
    } catch (err) {
        e.app.logger().warn("Turnstile siteverify failed", "error", String(err));
    }
    const hosts = ($os.getenv("TURNSTILE_HOSTNAMES") || "").split(",").map((h) => h.trim()).filter(Boolean);
    if (!data || !data.success || (hosts.length && hosts.indexOf(data.hostname) < 0)) {
        throw botCheckFailed("The bot check failed. Try again.");
    }
}

module.exports = { googleLinked, useGoogle, checkTurnstile };
