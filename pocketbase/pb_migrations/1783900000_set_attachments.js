/// <reference path="../pb_data/types.d.ts" />
// Adds the `set_attachments` collection: media that belongs to a *set*
// rather than to one tune — chiefly a backing track recorded for the whole
// set so it can be practised end to end.
//
// Sets have no table of their own (a set is the normalized `set` label
// shared by its tunes), so records key on `user` + `set_key`, where
// `set_key` is `normalizeSetName()` from src/lib/sets.js. `set_name` keeps
// the display spelling for reference only.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    "type": "base",
    "name": "set_attachments",
    "listRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "viewRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "deleteRule": "@request.auth.id != \"\" && user = @request.auth.id",
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
        "id": "relation_set_att_user",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_set_att_key",
        "max": 200,
        "min": 0,
        "name": "set_key",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_set_att_name",
        "max": 200,
        "min": 0,
        "name": "set_name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "file_set_att_file",
        "maxSelect": 1,
        "maxSize": 20971520,
        "mimeTypes": [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "audio/mpeg",
          "audio/mp4",
          "audio/ogg",
          "audio/wav",
          "audio/webm",
          "audio/flac",
          "audio/x-m4a",
          "audio/aac"
        ],
        "name": "file",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": null,
        "type": "file"
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "url_set_att_link",
        "name": "url",
        "onlyDomains": null,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "url"
      },
      {
        "hidden": false,
        "id": "select_set_att_type",
        "maxSelect": 1,
        "name": "type",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "sheet_music",
          "recording",
          "backing_track",
          "other",
          "source"
        ]
      },
      {
        "hidden": false,
        "id": "number_set_att_bpm",
        "max": null,
        "min": null,
        "name": "bpm",
        "onlyInt": true,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_set_att_label",
        "max": 200,
        "min": 0,
        "name": "label",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate_set_att_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_set_att_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_set_attachments_user_set` ON `set_attachments` (`user`, `set_key`)"
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("set_attachments")
  app.delete(collection)
})
