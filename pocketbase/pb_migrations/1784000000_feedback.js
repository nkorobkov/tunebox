/// <reference path="../pb_data/types.d.ts" />
// Adds the `feedback` collection behind the in-app "Leave feedback" form.
//
// `user` is deliberately optional with cascadeDelete off, and the submitter's
// address is denormalized into `user_email`: feedback should outlive the
// account that sent it, so a report stays readable (and answerable) even
// after the user is gone. Records are immutable once sent — update/delete
// rules are null, i.e. superuser only.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  const collection = new Collection({
    "type": "base",
    "name": "feedback",
    "listRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "viewRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "createRule": "@request.auth.id != \"\" && user = @request.auth.id",
    "updateRule": null,
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
        "cascadeDelete": false,
        "collectionId": users.id,
        "hidden": false,
        "id": "relation_feedback_user",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_feedback_email",
        "max": 255,
        "min": 0,
        "name": "user_email",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select_feedback_kind",
        "maxSelect": 1,
        "name": "kind",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": ["idea", "bug", "question", "other"]
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_feedback_message",
        "max": 5000,
        "min": 1,
        "name": "message",
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
        "id": "text_feedback_page",
        "max": 200,
        "min": 0,
        "name": "page",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "autodate_feedback_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate_feedback_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_feedback_user` ON `feedback` (`user`)"
    ]
  })

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("feedback")
  app.delete(collection)
})
