/// <reference path="../pb_data/types.d.ts" />
// Collections for the sheet-music recognition service (omr-service, behind /parse-abc):
//
// - `omr_services`: an auth collection with one account, the OMR service itself. It
//   logs in with its own password (kept in omr-service's .env), so the service writes
//   here with exactly the rights below instead of as a superuser. No API rules: only a
//   superuser can list or manage the accounts.
// - `omr_conversions`: one record per accepted upload. It is the conversion log (who,
//   when, outcome, timings), keeps the uploaded image and the result (ABC, MusicXML,
//   chords/fixes/warnings), and is what quotas are counted from ("30 per day" = a user's
//   records since midnight UTC). Anonymous visitors are identified only by a salted
//   hash of their address. Files are protected (downloads need a file token, i.e. the
//   owner or the service). Records are deleted with their user, and after 90 days by
//   pb_hooks/omr_retention.pb.js. Only the service creates and updates them; nobody but
//   a superuser deletes.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  const services = new Collection({
    "type": "auth",
    "name": "omr_services",
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
  })
  app.save(services)

  const service = "@request.auth.collectionName = \"omr_services\""
  const conversions = new Collection({
    "type": "base",
    "name": "omr_conversions",
    "listRule": `${service} || (@request.auth.id != "" && user = @request.auth.id)`,
    "viewRule": `${service} || (@request.auth.id != "" && user = @request.auth.id)`,
    "createRule": service,
    "updateRule": service,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": users.id,
        "hidden": false,
        "id": "relation_omr_user",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "hidden": false,
        "id": "select_omr_caller",
        "maxSelect": 1,
        "name": "caller",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["user", "anonymous", "key"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_omr_client",
        "max": 100,
        "min": 0,
        "name": "client",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_omr_ip_hash",
        "max": 64,
        "min": 0,
        "name": "ip_hash",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select_omr_status",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["queued", "running", "done", "failed", "rejected"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_omr_error_code",
        "max": 64,
        "min": 0,
        "name": "error_code",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "file_omr_image",
        "maxSelect": 1,
        "maxSize": 16777216,
        "mimeTypes": ["image/png", "image/jpeg", "image/webp"],
        "name": "image",
        "presentable": false,
        "protected": true,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_omr_abc",
        "max": 200000,
        "min": 0,
        "name": "abc",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "file_omr_musicxml",
        "maxSelect": 1,
        "maxSize": 10485760,
        "mimeTypes": [],
        "name": "musicxml",
        "presentable": false,
        "protected": true,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "hidden": false,
        "id": "json_omr_report",
        "maxSize": 2000000,
        "name": "report",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      },
      {
        "hidden": false,
        "id": "number_omr_width",
        "max": null,
        "min": 0,
        "name": "width",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_omr_height",
        "max": null,
        "min": 0,
        "name": "height",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_omr_bytes",
        "max": null,
        "min": 0,
        "name": "bytes",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number_omr_seconds",
        "max": null,
        "min": 0,
        "name": "seconds",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_omr_request_id",
        "max": 32,
        "min": 0,
        "name": "request_id",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate_omr_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_omr_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_omr_user_created` ON `omr_conversions` (`user`, `created`)",
      "CREATE INDEX `idx_omr_ip_created` ON `omr_conversions` (`ip_hash`, `created`)",
      "CREATE INDEX `idx_omr_caller_created` ON `omr_conversions` (`caller`, `created`)",
      "CREATE INDEX `idx_omr_created` ON `omr_conversions` (`created`)"
    ]
  })
  app.save(conversions)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("omr_conversions"))
  app.delete(app.findCollectionByNameOrId("omr_services"))
})
