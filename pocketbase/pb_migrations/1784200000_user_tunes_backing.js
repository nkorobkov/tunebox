/// <reference path="../pb_data/types.d.ts" />
// Adds `user_tunes.backing` (JSON): per-tune settings for the generated
// backing track. Today that's the chord chart —
//   { chords: ["", "Em", "Em D", "N.C.", …] | null, bars: <bar count> }
// — one value per written bar (format in src/lib/backing/chords.js). `bars`
// records the shape of the notation the chords were made for, so the app can
// set them aside if the ABC is later edited into a different bar count.
// `chords: null` means "use the guess", so improvements to the guesser
// still reach tunes whose chords were never changed.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_tunes")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "json_user_tunes_backing",
    "maxSize": 0,
    "name": "backing",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("user_tunes")
  collection.fields.removeById("json_user_tunes_backing")
  app.save(collection)
})
