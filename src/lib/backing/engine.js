import abcjs from 'abcjs';
import { claimPlaybackSession } from '../audio-session';
import { scheduleClick } from '../click';

// Renders an arrangement (arrange.js) to an AudioBuffer with abcjs's
// CreateSynth and plays it ourselves, so a loop can wrap exactly at the
// tune's end, and a synthesized drone can run alongside on the same clock.

const SOUNDFONT_URL = '/soundfonts/FluidR3_GM/';

let sharedCtx = null;

export function backingAudioContext() {
  if (!sharedCtx) {
    claimPlaybackSession();
    const Ctor = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new Ctor();
    abcjs.synth.registerAudioContext(sharedCtx);
  }
  return sharedCtx;
}

/** Must run inside the click handler (iOS only unlocks audio on a gesture). */
export function unlockAudio() {
  claimPlaybackSession();
  const ctx = backingAudioContext();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

export async function renderPlan(plan) {
  const synth = new abcjs.synth.CreateSynth();
  await synth.init({
    audioContext: backingAudioContext(),
    sequence: plan.sequence,
    millisecondsPerMeasure: plan.wholeSec * 1000, // sequence times are whole notes
    options: { soundFontUrl: SOUNDFONT_URL, fadeLength: 120 },
  });
  await synth.prime();
  return synth.getAudioBuffer();
}

const midiFreq = (m) => 440 * 2 ** ((m - 69) / 12);

// A harmonium/shruti-like drone: detuned saw pairs through a slowly
// breathing low-pass filter. Synthesized, so it needs no samples.
function startDrone(ctx, dest, { tonicMidi, fifth, level }, when) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, when);
  out.gain.linearRampToValueAtTime(level * 0.16, when + 1.2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 850;
  filter.Q.value = 0.4;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 160;
  lfo.connect(lfoDepth).connect(filter.frequency);
  filter.connect(out).connect(dest);

  const voices = [[tonicMidi - 12, 0.5], [tonicMidi, 1]];
  if (fifth) voices.push([tonicMidi + 7, 0.6]);
  const oscs = [lfo];
  for (const [midi, gain] of voices) {
    const g = ctx.createGain();
    g.gain.value = gain / voices.length;
    g.connect(filter);
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiFreq(midi);
      osc.detune.value = detune;
      osc.connect(g);
      oscs.push(osc);
    }
  }
  oscs.forEach(o => o.start(when));
  return {
    stop() {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.4);
      oscs.forEach(o => { try { o.stop(t + 0.45); } catch { /* already stopped */ } });
      setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, 600);
    },
  };
}

/**
 * Plays rendered backing. position() reports where in the arrangement
 * (whole notes, count-in included) playback is, wrapping with the loop.
 */
export class BackingPlayer {
  constructor(onEnded) {
    this.onEnded = onEnded;
    this.source = null;
    this.drone = null;
    this.plan = null;
    this.t0 = 0;
  }

  get playing() {
    return !!this.source;
  }

  start(buffer, plan, { from = 0, loop = true } = {}) {
    const ctx = backingAudioContext();
    this.stop();
    const ws = plan.wholeSec;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    src.loopStart = plan.loopStart * ws;
    src.loopEnd = plan.loopEnd * ws;
    src.connect(ctx.destination);
    const when = ctx.currentTime + 0.06;
    src.start(when, from * ws);
    src.onended = () => {
      if (this.source !== src) return;
      this.source = null;
      this.stopDrone();
      this.onEnded?.();
    };
    this.source = src;
    this.plan = plan;
    this.loop = loop;
    this.t0 = when - from * ws;
    this.clicks = (plan.countInClicks || [])
      .filter(c => c.t >= from - 1e-6)
      .map(c => scheduleClick(ctx, this.t0 + c.t * ws, c.accent));
    if (plan.drone) {
      this.drone = startDrone(ctx, ctx.destination, plan.drone, Math.max(when, this.t0 + plan.musicStart * ws));
    }
  }

  setLoop(loop) {
    if (!this.source || loop === this.loop) return;
    const pos = this.position();
    this.source.loop = loop;
    this.loop = loop;
    // re-anchor so position() stops (or starts) wrapping from here
    this.t0 = backingAudioContext().currentTime - pos * this.plan.wholeSec;
  }

  position() {
    if (!this.source || !this.plan) return null;
    const { wholeSec, loopStart, loopEnd } = this.plan;
    let p = (backingAudioContext().currentTime - this.t0) / wholeSec;
    if (this.loop && p > loopEnd) p = loopStart + ((p - loopStart) % (loopEnd - loopStart));
    return p;
  }

  stopDrone() {
    if (this.drone) this.drone.stop();
    this.drone = null;
  }

  stop() {
    (this.clicks || []).forEach(g => g.disconnect());
    this.clicks = [];
    const src = this.source;
    this.source = null;
    if (src) {
      try { src.stop(); } catch { /* never started */ }
      src.disconnect();
    }
    this.stopDrone();
  }
}
