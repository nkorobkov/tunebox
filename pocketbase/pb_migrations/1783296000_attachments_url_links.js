/// <reference path="../pb_data/types.d.ts" />
// Adds link-attachment support to the `attachments` collection:
//  - new optional `url` field (YouTube links etc.)
//  - `file` becomes optional (a record holds a file OR a url)
//  - new `source` value in the `type` select
migrate((app) => {
  const collection = app.findCollectionByNameOrId("attachments")

  // file: required -> optional
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "file2359244304",
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
  }))

  // type: add "source"
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select2363381545",
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
  }))

  // new url field
  collection.fields.addAt(5, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "url_attachment_link",
    "name": "url",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url"
  }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("attachments")

  collection.fields.removeById("url_attachment_link")

  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "file2359244304",
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
    "required": true,
    "system": false,
    "thumbs": null,
    "type": "file"
  }))

  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select2363381545",
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
      "other"
    ]
  }))

  app.save(collection)
})
