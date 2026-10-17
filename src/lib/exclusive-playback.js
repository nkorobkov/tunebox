// Practice sound sources that shouldn't play over each other (metronome,
// generated backing): starting one stops whichever was playing. Each source
// owns a token whose `stop` is kept current by the caller.
let current = null;

export function claimPlayback(token) {
  const previous = current;
  current = token;
  if (previous && previous !== token) previous.stop();
}

export function releasePlayback(token) {
  if (current === token) current = null;
}
