// The metronome click, shared by the metronome and the backing's count-in so
// both sound the same. Returns the gain node; disconnect it to cancel a click
// that hasn't sounded yet (the oscillator's stop is already scheduled).
export function scheduleClick(ctx, time, accent, destination = ctx.destination) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(destination);
  osc.frequency.value = accent ? 1500 : 1000;
  gain.gain.setValueAtTime(accent ? 0.9 : 0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  osc.start(time);
  osc.stop(time + 0.08);
  return gain;
}
