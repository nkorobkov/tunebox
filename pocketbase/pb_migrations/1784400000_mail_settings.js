/// <reference path="../pb_data/types.d.ts" />
// Outgoing mail through Resend's SMTP relay, ahead of email/password sign-in
// (verification and password-reset emails).
//
// - Settings: app name/URL (`{APP_NAME}`/`{APP_URL}` in templates) and the sender, plus
//   the Resend SMTP host. The credential (a Resend API key) is NOT here: it was entered
//   on the server only (admin UI → Settings → Mail settings, or a one-off migration that
//   is not checked in), which is also where SMTP is switched on.
// - `users` email templates: the verification and password-reset links point at the
//   app (`/auth/verify/:token`, `/auth/reset/:token`) instead of PB's admin UI, which
//   is behind basic auth and unusable for visitors.
// - Login alerts off: PB sends a "new login" email whenever an account signs in from
//   an unseen IP + user agent, and that includes Google OAuth2 sign-ins — with working
//   mail, every browser update or network change would email Google users. Revisit
//   once password sign-in exists, where the alert is actually useful.
const APP_LINKS = [
  ["verificationTemplate", "/_/#/auth/confirm-verification/", "/auth/verify/"],
  ["resetPasswordTemplate", "/_/#/auth/confirm-password-reset/", "/auth/reset/"],
]

function relink(app, from, to) {
  const users = app.findCollectionByNameOrId("users")
  for (const [template, adminPath, appPath] of APP_LINKS) {
    const [a, b] = from === "admin" ? [adminPath, appPath] : [appPath, adminPath]
    const body = users[template].body
    if (!body.includes("{APP_URL}" + a)) {
      console.log(`[mail_settings] users.${template}: link not found, left unchanged`)
      continue
    }
    users[template].body = body.split("{APP_URL}" + a).join("{APP_URL}" + b)
  }
  return users
}

migrate((app) => {
  const settings = app.settings()
  settings.meta.appName = "TuneBox"
  settings.meta.appURL = "https://tunebox.net"
  settings.meta.senderName = "TuneBox"
  settings.meta.senderAddress = "no-reply@tunebox.net"
  settings.smtp.host = "smtp.resend.com"
  settings.smtp.port = 465
  settings.smtp.tls = true
  settings.smtp.authMethod = "PLAIN"
  settings.smtp.username = "resend"
  app.save(settings)

  const users = relink(app, "admin", "app")
  users.authAlert.enabled = false
  app.save(users)
}, (app) => {
  const users = relink(app, "app", "admin")
  users.authAlert.enabled = true
  app.save(users)
})
