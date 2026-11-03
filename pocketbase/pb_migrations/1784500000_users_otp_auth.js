/// <reference path="../pb_data/types.d.ts" />
// Email sign-in for `users`: one-time codes as the main method, passwords as an
// optional backup, Google OAuth2 unchanged. The rules that tie them together (Google
// accounts are Google-only, sign-up through a code request, Turnstile on code requests)
// live in pb_hooks/auth_rules.pb.js.
//
// - createRule: only OAuth2 sign-up may create records through the API. Code sign-ups
//   are created by the hook (which isn't bound by the rule). With a public create rule
//   and password auth on, anyone could register someone else's address with a password
//   of their choosing and have it start working once the owner verified the email by code.
// - OTP: 6 digits, valid 10 minutes, code in the subject (shows in notification previews).
//   A successful code sign-in marks the email verified, which authRule requires.
// - Password reset email reworded: it's how a code account sets a backup password.
// - Rate limits (per IP) for sending codes/reset links and password attempts.
const RATE_LIMITS = [
  { label: "users:requestOTP", maxRequests: 5, duration: 300 },
  { label: "users:requestPasswordReset", maxRequests: 3, duration: 300 },
  { label: "users:authWithPassword", maxRequests: 10, duration: 300 },
]

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  users.createRule = '@request.context = "oauth2"'

  users.passwordAuth.enabled = true
  users.otp.enabled = true
  users.otp.length = 6
  users.otp.duration = 600
  users.otp.emailTemplate.subject = "Your {APP_NAME} sign-in code: {OTP}"
  users.otp.emailTemplate.body = `<p>Hello,</p>
<p>Your {APP_NAME} sign-in code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{OTP}</p>
<p>It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
<p>
  Thanks,<br/>
  {APP_NAME}
</p>`

  users.resetPasswordTemplate.subject = "Set your {APP_NAME} password"
  users.resetPasswordTemplate.body = `<p>Hello,</p>
<p>Click the button below to set a password for your {APP_NAME} account. You can keep signing in with an emailed code as well.</p>
<p>
  <a class="btn" href="{APP_URL}/auth/reset/{TOKEN}" target="_blank" rel="noopener">Set password</a>
</p>
<p><i>If you didn't ask for this, you can ignore this email.</i></p>
<p>
  Thanks,<br/>
  {APP_NAME}
</p>`
  app.save(users)

  const settings = app.settings()
  const rules = settings.rateLimits.rules.filter((r) => !RATE_LIMITS.some((n) => n.label === r.label))
  settings.rateLimits.rules = rules.concat(RATE_LIMITS.map((r) => ({ ...r, audience: "" })))
  settings.rateLimits.enabled = true
  app.save(settings)
}, (app) => {
  const users = app.findCollectionByNameOrId("users")
  users.createRule = ""
  users.otp.enabled = false
  app.save(users)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => !RATE_LIMITS.some((n) => n.label === r.label))
  app.save(settings)
})
