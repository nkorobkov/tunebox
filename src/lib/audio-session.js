// iOS plays Web Audio in the "ambient" session, which the ring/silent switch
// mutes — tune and backing playback were silent on a phone set to silent.
// Claiming the "playback" session makes them behave like a music player.
// Call before (or as) the AudioContext is created; a no-op where the
// Audio Session API is missing (everything but Safari 17+ / iOS browsers).
// Claimed only once tune or backing playback is used, not on app start:
// "playback" isn't mixable, and a metronome-only session should keep letting
// people click along to a recording playing in another app. (The type is
// per page, so after that the metronome follows it too.)
export function claimPlaybackSession() {
  try {
    if ('audioSession' in navigator && navigator.audioSession.type !== 'playback') {
      navigator.audioSession.type = 'playback';
    }
  } catch {
    // older Safari throws on assignment — nothing to do
  }
}
