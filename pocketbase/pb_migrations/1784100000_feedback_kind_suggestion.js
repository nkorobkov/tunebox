/// <reference path="../pb_data/types.d.ts" />
// Renames the feedback `kind` option "idea" -> "suggestion", and rewrites any
// rows already carrying the old value so no record is left holding an option
// the select no longer offers.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("feedback")

  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "select_feedback_kind",
    "maxSelect": 1,
    "name": "kind",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": ["suggestion", "bug", "question", "other"]
  }))

  app.save(collection)

  app.db().newQuery("UPDATE feedback SET kind = 'suggestion' WHERE kind = 'idea'").execute()
}, (app) => {
  const collection = app.findCollectionByNameOrId("feedback")

  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "select_feedback_kind",
    "maxSelect": 1,
    "name": "kind",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": ["idea", "bug", "question", "other"]
  }))

  app.save(collection)

  app.db().newQuery("UPDATE feedback SET kind = 'idea' WHERE kind = 'suggestion'").execute()
})
