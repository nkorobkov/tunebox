import abcjs from 'abcjs';
import { resolveChords } from './chords';
import {
  rhythmFamily, beatSlots, patternFor, drumPatternFor, swingValue, swingSupported,
  STRUM_PATTERNS, PIANO_PATTERNS,
} from './patterns';
import { INSTRUMENTS, BASS_PROGRAM } from './prefs';
import { openImplicitRepeats } from '../abc-utils';

// Builds the whole backing as an abcjs note sequence (times in whole notes).
//
// The melody comes from abcjs itself (setUpAudio, repeats and endings
// expanded). Every melody note carries the startChar of its ABC element, which
// maps back to a written bar of the model — so we know which bar is playing
// when, including repeats — and everything else (chords, bass, drums,
// count-in, ending) is generated against that timeline. The sequence is
// rendered by CreateSynth.init({ sequence }), which preloads every sample the
// sequence uses; abcjs's own chord track is never used.

const EIGHTH = 0.125;
const EPS = 1e-4;
const DRUM = 128;
const BODHRAN = { X: [41, 105], x: [41, 72], o: [45, 48] };

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mod12 = (n) => ((n % 12) + 12) % 12;
const inRange = (pc, lo) => lo + mod12(pc - lo);

/** Which written bar is playing when: [{ bar, start }] in sequence order. */
export function buildTimeline(track, model) {
  const occ = [];
  let cur = null;
  for (const ev of track) {
    if (ev.cmd !== 'note' || ev.startChar === undefined || ev.startChar === null) continue;
    const pos = model.charMap.get(ev.startChar);
    if (!pos) continue;
    const start = ev.start - pos.off;
    const len = model.bars[pos.bar].length;
    if (!cur || pos.bar !== cur.bar || start >= cur.start + len - EPS) {
      cur = { bar: pos.bar, start };
      occ.push(cur);
    } else if (start < cur.start) {
      // a grace note delays the note it decorates; the earliest note wins
      cur.start = start;
    }
  }
  // bars with no sounding note of their own (rests, ties) fill the gaps
  const out = [];
  occ.forEach((o, i) => {
    out.push(o);
    const next = occ[i + 1];
    let t = o.start + model.bars[o.bar].length;
    let b = o.bar + 1;
    while (next && next.start - t > EPS && b < model.bars.length && t + model.bars[b].length <= next.start + EPS) {
      out.push({ bar: b, start: t });
      t += model.bars[b].length;
      b++;
    }
  });
  return out.map(o => ({ ...o, start: Math.round(o.start * 1e6) / 1e6 }));
}

function guitarVoicing(chord, transpose) {
  const tones = chord.tones.map(pc => mod12(pc + transpose));
  const bass = inRange(chord.bassPc + transpose, 40);
  const upper = [];
  for (let p = Math.max(52, bass + 3); p <= 67 && upper.length < 5; p++) {
    if (tones.includes(mod12(p))) upper.push(p);
  }
  return { bass, upper };
}

function pianoVoicing(chord, transpose) {
  const tones = chord.tones.map(pc => mod12(pc + transpose));
  const notes = [];
  for (let p = 55; p <= 67 && notes.length < 4; p++) if (tones.includes(mod12(p))) notes.push(p);
  return notes;
}

const fifthPc = (chord) => (chord.tones.length >= 3 ? chord.tones[2] : chord.rootPc + 7);

/**
 * @returns plan {
 *   sequence, wholeSec, musicStart, loopStart, loopEnd, end (whole notes),
 *   countInClicks: [{ t, accent }] (played by the engine, not in the sequence),
 *   timeline: [{bar, start}] (shifted), drone: { tonicMidi } | null
 * } or null when the tune has nothing playable.
 */
export function arrange({ abc, model, chordValues, tempo, transpose = 0, prefs, tuneType, seed = 1 }) {
  if (!abc || !model) return null;
  const tune = abcjs.parseOnly(abc)[0];
  if (!tune) return null;
  openImplicitRepeats(tune);
  const melodyProgram = INSTRUMENTS[prefs.melody]?.program ?? 0;
  const flat = tune.setUpAudio({ program: melodyProgram, midiTranspose: transpose, chordsOff: true });
  const voiceTracks = flat.tracks.filter(t => t.some(e => e.cmd === 'note' && e.instrument !== DRUM));
  if (!voiceTracks.length) return null;
  const timeline = buildTimeline(voiceTracks[0], model);
  if (!timeline.length) return null;

  const wholeSec = 240 / tempo;
  const barLength = model.barLength;
  const family = rhythmFamily(model.meter, tuneType);
  const fullSlots = Math.round(barLength / EIGHTH);
  const { beats, pulses } = beatSlots(family, fullSlots);
  const resolved = resolveChords(model, chordValues);
  const vol = prefs.volumes;
  const random = rng(seed);
  const jitter = (sec) => ((random() * 2 - 1) * sec) / wholeSec;
  const human = (v) => v * (1 + (random() * 2 - 1) * 0.06);

  // ---- timing frame ---------------------------------------------------------
  const first = timeline[0];
  const firstBar = model.bars[first.bar];
  const downbeat = firstBar.pickup ? first.start + firstBar.length : first.start;
  const countIn = prefs.countIn ? barLength : 0;
  const shift = prefs.countIn ? Math.max(0, countIn - downbeat) : 0;
  const last = timeline[timeline.length - 1];
  const lastLen = model.bars[last.bar].length;
  const pickupLen = firstBar.pickup ? firstBar.length : 0;
  // A short last bar that completes the pickup loops straight back into it;
  // otherwise loop from the first downbeat to the end of a full last bar.
  const seamless = pickupLen > 0 && Math.abs(lastLen + pickupLen - barLength) < EPS;
  const loopStart = shift + (seamless ? first.start : downbeat);
  const loopEnd = shift + last.start + (seamless ? lastLen : barLength);
  const endAt = shift + last.start + barLength;

  // generated events: { grid (whole-note time before swing), offset, pitch, volume, duration, instrument }
  const chordsTrack = [];
  const bassTrack = [];
  const drumTrack = [];
  const add = (track, ev) => {
    if (ev.volume <= 0) return;
    track.push(ev);
  };
  // Trims measured so the default mix (prefs.js) puts melody, strum, bass and
  // bodhrán at roughly equal loudness (rendered RMS, Drowsy Maggie at 110).
  const LAYER_TRIM = { chords: 0.55, bass: 0.9, drums: 0.5 };
  const scale = (layer) => ((vol[layer] ?? 0) / 75) * (LAYER_TRIM[layer] ?? 1);

  const chordInstrument = prefs.chordStyle === 'piano'
    ? INSTRUMENTS.piano.program
    : INSTRUMENTS[prefs.chordInstrument]?.program ?? INSTRUMENTS.steel.program;
  const strumPattern = patternFor(STRUM_PATTERNS, family, prefs.strumPatterns?.[family], fullSlots, 'D');
  const pianoPattern = patternFor(PIANO_PATTERNS, family, prefs.pianoPatterns?.[family], fullSlots, 'c');
  const drumPattern = drumPatternFor(family, fullSlots);
  const strumGapSec = 0.011;

  timeline.forEach((occ, k) => {
    const bar = model.bars[occ.bar];
    if (k === 0 && bar.pickup) return;
    const t0 = occ.start + shift;
    const slots = Math.max(1, Math.round(bar.length / EIGHTH));
    const half = fullSlots / 2;
    const [c1, c2] = resolved[occ.bar];
    const chordAt = (s) => (s < half ? c1 : c2);
    const nextOcc = timeline[k + 1];
    const nextChord = nextOcc ? resolved[nextOcc.bar][0] : null;

    // How many slots a hit at `s` rings: to the next hit, or a chord change.
    const ringFrom = (pattern, s) => {
      let e = s + 1;
      while (e < slots && pattern[e] === '.' && chordAt(e) === chordAt(s)) e++;
      return Math.min(e - s, 4);
    };

    // ---- chords ---------------------------------------------------------------
    if (prefs.chordStyle !== 'piano' && scale('chords') > 0) {
      const level = scale('chords');
      for (let s = 0; s < slots; s++) {
        const ch = strumPattern[s];
        const chord = chordAt(s);
        if (!ch || ch === '.' || !chord) continue;
        const v = guitarVoicing(chord, transpose);
        const grid = t0 + s * EIGHTH;
        const dur = ringFrom(strumPattern, s) * EIGHTH * 0.95;
        const base = { D: 92, d: 72, U: 66, u: 50, B: 84 }[ch] * level;
        if (ch === 'B') {
          add(chordsTrack, { grid, offset: 0, pitch: v.bass, volume: human(base), duration: dur, instrument: chordInstrument });
          continue;
        }
        const up = ch === 'U' || ch === 'u';
        const withBass = !up && pulses.includes(s);
        let notes = up ? v.upper.slice(-3).reverse() : [...(withBass ? [v.bass] : []), ...v.upper];
        const gap = (strumGapSec * (up ? 0.8 : 1)) / wholeSec;
        const strumVol = human(base);
        notes.forEach((pitch, j) => add(chordsTrack, {
          grid, offset: j * gap, pitch, volume: strumVol * (1 - j * 0.03), duration: dur, instrument: chordInstrument,
        }));
      }
    } else if (prefs.chordStyle === 'piano' && scale('chords') > 0) {
      const level = scale('chords');
      let bassCount = 0;
      for (let s = 0; s < slots; s++) {
        const ch = pianoPattern[s];
        const chord = chordAt(s);
        if (!ch || ch === '.' || !chord) continue;
        const grid = t0 + s * EIGHTH;
        if (ch === 'b') {
          const pc = bassCount++ % 2 === 0 ? chord.bassPc : fifthPc(chord);
          add(chordsTrack, { grid, offset: 0, pitch: inRange(pc + transpose, 40), volume: human(80 * level), duration: ringFrom(pianoPattern, s) * EIGHTH * 0.9, instrument: chordInstrument });
        } else {
          const stab = pianoVoicing(chord, transpose);
          const volume = human((ch === 'C' ? 74 : 60) * level);
          stab.forEach(pitch => add(chordsTrack, { grid, offset: 0, pitch, volume, duration: EIGHTH * 0.8, instrument: chordInstrument }));
        }
      }
    }

    // ---- bass -----------------------------------------------------------------
    if (scale('bass') > 0) {
      const level = scale('bass');
      const positions = (prefs.bass === 'walking' ? beats : pulses).filter(s => s < slots);
      // a chord change on the half bar always gets a bass note
      if (c1 !== c2 && c2 && !positions.includes(half) && half < slots) positions.push(half);
      positions.sort((a, b) => a - b);
      positions.forEach((s, j) => {
        const chord = chordAt(s);
        if (!chord) return;
        let pc = chord.bassPc;
        if (prefs.bass === 'rootFifth') {
          const alt = pulses.length === 1 ? k % 2 === 1 : j % 2 === 1;
          if (alt && !(s === half && c1 !== c2)) pc = fifthPc(chord);
        } else if (prefs.bass === 'walking') {
          const lastBeat = j === positions.length - 1;
          const target = (lastBeat && nextChord && nextChord !== chord) ? nextChord : null;
          const walk = positions.length === 2
            ? [chord.bassPc, fifthPc(chord)]
            : [chord.bassPc, chord.tones[1], fifthPc(chord), chord.tones[1]];
          if (j === 0 || (s === half && c1 !== c2)) pc = chord.bassPc;
          else if (target) pc = target.bassPc - 1; // chromatic approach from below
          else pc = walk[j] ?? chord.rootPc;
        }
        const end = positions[j + 1] ?? slots;
        add(bassTrack, {
          grid: t0 + s * EIGHTH, offset: 0, pitch: inRange(pc + transpose, 33),
          volume: human((j === 0 ? 96 : 82) * level), duration: (end - s) * EIGHTH * 0.92, instrument: BASS_PROGRAM,
        });
      });
    }

    // ---- bodhrán --------------------------------------------------------------
    if (scale('drums') > 0) {
      const level = scale('drums');
      for (let s = 0; s < slots; s++) {
        const hit = BODHRAN[drumPattern[s]];
        if (!hit) continue;
        add(drumTrack, { grid: t0 + s * EIGHTH, offset: 0, pitch: hit[0], volume: human(hit[1] * level), duration: EIGHTH, instrument: DRUM });
      }
    }
  });

  // ---- ending: one ringing chord on the downbeat after the tune ---------------
  const finalChord = (() => {
    const r = resolved[last.bar];
    return r[1] || r[0];
  })();
  if (finalChord) {
    if (scale('chords') > 0) {
      const notes = prefs.chordStyle === 'piano'
        ? [inRange(finalChord.bassPc + transpose, 40), ...pianoVoicing(finalChord, transpose)]
        : (({ bass, upper }) => [bass, ...upper])(guitarVoicing(finalChord, transpose));
      notes.forEach((pitch, j) => chordsTrack.push({
        grid: endAt, offset: (prefs.chordStyle === 'piano' ? 0 : j * 0.025 / wholeSec), pitch,
        volume: 80 * scale('chords'), duration: barLength, instrument: chordInstrument, fixed: true,
      }));
    }
    if (scale('bass') > 0) {
      bassTrack.push({ grid: endAt, offset: 0, pitch: inRange(finalChord.bassPc + transpose, 33), volume: 92 * scale('bass'), duration: barLength, instrument: BASS_PROGRAM, fixed: true });
    }
    if (scale('drums') > 0) {
      drumTrack.push({ grid: endAt, offset: 0, pitch: 41, volume: 105 * scale('drums'), duration: EIGHTH, instrument: DRUM, fixed: true });
    }
  }

  // ---- count-in: the metronome's own click, scheduled by the engine -----------
  const countInClicks = [];
  if (prefs.countIn) {
    const countBeats = family === 'threetwo' ? [0, 4, 8] : beats;
    countBeats.forEach((s, j) => countInClicks.push({ t: s * EIGHTH, accent: j === 0 }));
  }

  // ---- swing, humanising, and conversion to abcjs events --------------------------
  const swing = swingSupported(family) ? swingValue(prefs.swing, family) : 50;
  const swingBy = swing > 50 ? EIGHTH * (swing / 50 - 1) : 0;
  const starts = timeline.map(o => o.start + shift);
  const barStartAt = (t) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= t + EPS) lo = mid; else hi = mid - 1;
    }
    return starts[lo];
  };
  const swung = (t, duration) => {
    if (!swingBy) return { t, duration };
    const rel = t - barStartAt(t);
    const inBeat = ((rel % 0.25) + 0.25) % 0.25;
    if (Math.abs(inBeat - EIGHTH) < EPS) return { t: t + swingBy, duration: Math.max(0.01, duration - swingBy) };
    if (inBeat < EPS && Math.abs(duration - EIGHTH) < 0.02) return { t, duration: duration + swingBy };
    return { t, duration };
  };
  const q = (v) => Math.max(1, Math.min(127, Math.round(v / 4) * 4));
  const qd = (d) => Math.max(1 / 192, Math.round(d * 192) / 192);
  const toEvents = (track, { humanise }) => track.map(ev => {
    const { t, duration } = ev.fixed ? { t: ev.grid, duration: ev.duration } : swung(ev.grid, ev.duration);
    const start = Math.max(0, t + ev.offset + (humanise && !ev.fixed ? jitter(0.005) : 0));
    return { cmd: 'note', pitch: ev.pitch, volume: q(ev.volume), start, duration: qd(duration), instrument: ev.instrument, gap: 0 };
  });

  const melodyLevel = (vol.melody ?? 0) / 60;
  const tracks = [];
  if (melodyLevel > 0) {
    voiceTracks.forEach((track, i) => {
      const notes = track.filter(e => e.cmd === 'note').map(e => {
        const { t, duration } = swung(e.start + shift, e.duration);
        return { cmd: 'note', pitch: e.pitch, volume: q(e.volume * melodyLevel), start: t, duration: qd(duration), instrument: melodyProgram, gap: 0 };
      });
      tracks.push([{ cmd: 'program', channel: i, instrument: melodyProgram }, ...notes]);
    });
  }
  const pushTrack = (events, instrument, channel) => {
    if (events.length) tracks.push([{ cmd: 'program', channel, instrument }, ...events.sort((a, b) => a.start - b.start)]);
  };
  pushTrack(toEvents(chordsTrack, { humanise: true }), chordInstrument, 10);
  pushTrack(toEvents(bassTrack, { humanise: true }), BASS_PROGRAM, 11);
  pushTrack(toEvents(drumTrack, { humanise: true }), DRUM, 9);
  if (!tracks.length) {
    // everything muted: keep a silent placeholder so the timeline still runs
    tracks.push([{ cmd: 'program', channel: 0, instrument: 0 }, { cmd: 'note', pitch: 60, volume: 1, start: 0, duration: EIGHTH, instrument: 0, gap: 0 }]);
  }

  const droneOn = (vol.drone ?? 0) > 0;
  return {
    sequence: { tracks, totalDuration: endAt + barLength * 1.25 },
    wholeSec,
    musicStart: shift,
    countInClicks,
    loopStart,
    loopEnd,
    end: endAt + barLength,
    timeline: timeline.map(o => ({ bar: o.bar, start: o.start + shift })),
    drone: droneOn ? { tonicMidi: inRange(model.key.tonicPc + transpose, 45), fifth: prefs.drone === 'fifth', level: vol.drone / 100 } : null,
  };
}
