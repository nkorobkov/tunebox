// Chord names, per-bar chord values, and the chord guesser.
//
// A tune's chords are one string per written bar (see abc-bars.js):
//   'G'      the whole bar
//   'G D'    two chords, one per half bar
//   ''       carry on the previous chord (a pickup with nothing before it is silent)
//   '% D'    carry on for the first half, D for the second
//   'N.C.'   no chord: the backing rests for the bar (drums keep going)

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const EPS = 1e-6;

export const NO_CHORD = 'N.C.';

const QUALITIES = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  five: [0, 7],
};

/**
 * Parse a chord name ("G", "Em", "D7", "F#m7", "Bbmaj7", "G/B", "Asus4").
 * Returns { rootPc, bassPc, tones: [pc…], minor, name } or null.
 */
export function parseChord(raw) {
  if (!raw) return null;
  const name = String(raw).trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = name.match(/^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/);
  if (!m) return null;
  const rootPc = (LETTER_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  let rest = m[3];
  let quality = 'maj';
  let seventh = null;
  if (/^(m7b5|ø)/.test(rest)) { quality = 'dim'; seventh = 10; rest = ''; }
  else if (/^(dim|o)/.test(rest)) { quality = 'dim'; seventh = /7/.test(rest) ? 9 : null; rest = ''; }
  else if (/^(aug|\+)/.test(rest)) { quality = 'aug'; rest = rest.replace(/^(aug|\+)/, ''); }
  else if (/^(maj|M|Δ)/.test(rest)) { rest = rest.replace(/^(maj|M|Δ)/, ''); if (/^7|^9/.test(rest)) { seventh = 11; rest = rest.slice(1); } }
  else if (/^(min|m|-)/.test(rest)) { quality = 'min'; rest = rest.replace(/^(min|m|-)/, ''); }
  if (/^sus2/.test(rest)) { quality = 'sus2'; rest = rest.slice(4); }
  else if (/^sus4?/.test(rest)) { quality = 'sus4'; rest = rest.replace(/^sus4?/, ''); }
  if (/^5$/.test(rest)) { quality = 'five'; rest = ''; }
  if (/^(7|9|11|13)/.test(rest) && seventh === null) { seventh = 10; rest = rest.replace(/^(7|9|11|13)/, ''); }
  if (/^6/.test(rest)) { rest = rest.slice(1); }
  if (/^(add\d+)?$/.test(rest) === false) return null;
  const tones = QUALITIES[quality].map(i => (rootPc + i) % 12);
  if (seventh !== null) tones.push((rootPc + seventh) % 12);
  const bassPc = m[4] ? (LETTER_PC[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) + 12) % 12 : rootPc;
  return { rootPc, bassPc, tones, minor: quality === 'min' || quality === 'dim', seventh: seventh !== null ? (rootPc + seventh) % 12 : null, name };
}

export function pcName(pc, flats) {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
}

/** Transpose a chord name by semitones, keeping its quality and slash bass. */
export function transposeChordName(name, semitones, flats) {
  if (!semitones || !name || name === NO_CHORD) return name;
  const m = name.match(/^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/);
  if (!m) return name;
  const shift = (n) => pcName(parseChord(n).rootPc + semitones, flats);
  return shift(m[1]) + m[2] + (m[3] ? '/' + shift(m[3]) : '');
}

// ---- per-bar values ---------------------------------------------------------

export function barSlots(value) {
  const v = (value || '').trim();
  if (!v) return [''];
  return v.split(/\s+/).slice(0, 2).map(s => (s === '%' ? '' : s));
}

export function joinSlots(slots) {
  const clean = slots.map(s => (s || '').trim());
  if (clean.length === 2 && clean[0] === clean[1]) return clean[0];
  if (clean.length === 2 && !clean[1]) return clean[0];
  if (clean.length === 2 && !clean[0]) return `% ${clean[1]}`;
  return clean.join(' ').trim();
}

/** Can this bar hold two chords? (Full bars of meters with a clear half.) */
export function canSplit(model, bar) {
  if (!bar || bar.partial) return false;
  const { num, den } = model.meter;
  return (num === 4 && den === 4) || (num === 2 && den === 2) || (num === 6 && den === 8)
    || (num === 12 && den === 8) || (num === 3 && den === 2) || (num === 4 && den === 2);
}

// ---- key palette ------------------------------------------------------------

// Chords that sit naturally in each mode: [semitones above tonic, minor?, how
// often trad backing reaches for it]. Lydian/phrygian/locrian keys were folded
// into major/minor when the key was read.
const MODE_CHORDS = {
  major: [[0, false, 1], [7, false, 0.95], [5, false, 0.9], [9, true, 0.75], [2, true, 0.6], [4, true, 0.4]],
  mixolydian: [[0, false, 1], [10, false, 0.95], [5, false, 0.8], [7, true, 0.6], [2, true, 0.5], [9, true, 0.45]],
  dorian: [[0, true, 1], [10, false, 0.95], [3, false, 0.8], [5, false, 0.75], [7, true, 0.6], [2, true, 0.4]],
  minor: [[0, true, 1], [10, false, 0.9], [3, false, 0.8], [5, true, 0.75], [8, false, 0.7], [7, true, 0.55]],
};

// A few common colours outside the plain diatonic set, offered in the editor only.
const MODE_EXTRAS = {
  major: [[7, '7'], [2, ''], [10, ''], [0, '7']],
  mixolydian: [[7, ''], [0, '7'], [7, '7']],
  dorian: [[7, ''], [0, ''], [7, '7']],
  minor: [[7, ''], [7, '7'], [5, '']],
};

function keyCandidates(key) {
  return (MODE_CHORDS[key.mode] || MODE_CHORDS.major).map(([iv, minor, prior]) => {
    const rootPc = (key.tonicPc + iv) % 12;
    const name = pcName(rootPc, key.flats) + (minor ? 'm' : '');
    return { name, prior, chord: parseChord(name), tonic: iv === 0 };
  });
}

/** Chord names for the editor: the mode's own chords, then a few colours. */
export function keyPalette(key) {
  const main = keyCandidates(key).map(c => c.name);
  const extras = (MODE_EXTRAS[key.mode] || []).map(([iv, suffix]) => pcName(key.tonicPc + iv, key.flats) + suffix);
  return { main, extras: extras.filter(n => !main.includes(n)) };
}

/** The key moved by `semitones`, spelled with flats where its signature has them. */
export function transposeKey(key, semitones) {
  if (!semitones) return key;
  const tonicPc = ((key.tonicPc + semitones) % 12 + 12) % 12;
  // the relative major decides the signature: F Bb Eb Ab Db are flat keys
  const relative = { major: 0, minor: 3, dorian: 10, mixolydian: 5 }[key.mode] ?? 0;
  const flats = [5, 10, 3, 8, 1].includes((tonicPc + relative) % 12);
  return { ...key, tonicPc, flats };
}

export function keyName(key) {
  if (!key) return '';
  const mode = { major: 'major', minor: 'minor', dorian: 'Dorian', mixolydian: 'Mixolydian' }[key.mode] || key.mode;
  return `${pcName(key.tonicPc, key.flats)} ${mode}`;
}

// ---- guessing ---------------------------------------------------------------

function metricWeight(off, model) {
  const { meter, barLength } = model;
  const compound = meter.den === 8 && meter.num % 3 === 0;
  const beat = compound ? 0.375 : 1 / Math.max(4, meter.den);
  if (off < EPS) return 1.6;
  if (barLength >= 0.75 && Math.abs(off - barLength / 2) < EPS) return 1.3;
  if (Math.abs(off / beat - Math.round(off / beat)) < EPS) return 1.05;
  return 0.8;
}

function fitScore(notes, chord, model) {
  let sum = 0;
  let total = 0;
  for (const n of notes) {
    const w = n.dur * metricWeight(n.off, model) * (n.dur < 0.0625 - EPS ? 0.6 : 1);
    let fit;
    if (n.pc === chord.rootPc) fit = 1;
    else if (n.pc === chord.seventh) fit = 0.4;
    else if (chord.tones.includes(n.pc)) fit = 0.85;
    else fit = -0.45;
    sum += w * fit;
    total += w;
  }
  return total > 0 ? sum / total : null;
}

function best(notes, candidates, model, { prev, cadence, opening }) {
  let top = null;
  for (const c of candidates) {
    const fit = fitScore(notes, c.chord, model);
    if (fit === null) return null;
    let score = fit + 0.25 * c.prior;
    if (prev && prev === c.name) score += 0.06;
    if (c.tonic && cadence) score += 0.25;
    if (c.tonic && opening) score += 0.12;
    if (!top || score > top.score) top = { name: c.name, score };
  }
  return top;
}

function isPartEnd(model, i) {
  const bars = model.bars;
  const next = bars[i + 1];
  if (!next) return true;
  if (next.part !== bars[i].part) return true;
  // the bars of a 1st/2nd ending close the part
  return !!bars[i].ending;
}

/**
 * Guess chords from the melody: for every bar, score each chord of the key by
 * how much of the bar's melody (weighted by length and beat position) are its
 * chord tones, nudged towards common choices, towards keeping the previous
 * chord, and towards the home chord at the ends of parts. A bar splits into
 * two chords only when the halves clearly want different ones.
 */
export function suggestChords(model) {
  const out = [];
  let prev = null;
  let sawFull = false;
  model.bars.forEach((bar, i) => {
    if (bar.pickup || !bar.notes.length) { out.push(''); return; }
    const candidates = keyCandidates(bar.key);
    const cadence = isPartEnd(model, i);
    const ctx = { prev, cadence, opening: !sawFull };
    const whole = best(bar.notes, candidates, model, ctx);
    if (!whole) { out.push(''); return; }
    let value = whole.name;
    if (canSplit(model, bar)) {
      const half = model.barLength / 2;
      const a = bar.notes.filter(n => n.off < half - EPS);
      const b = bar.notes.filter(n => n.off >= half - EPS);
      const first = a.length ? best(a, candidates, model, { prev, opening: !sawFull }) : null;
      const second = first && b.length ? best(b, candidates, model, { prev: first.name, cadence }) : null;
      if (first && second && first.name !== second.name && (first.score + second.score) / 2 - whole.score > 0.25) {
        value = `${first.name} ${second.name}`;
      }
    }
    out.push(value);
    prev = barSlots(value).slice(-1)[0];
    sawFull = true;
  });
  return out;
}

/** Chords already written in the ABC, in the per-bar format, or null if none. */
export function chordsFromAbc(model) {
  if (!model.bars.some(b => b.existing.length)) return null;
  const half = model.barLength / 2;
  return model.bars.map(bar => {
    const valid = bar.existing.filter(e => parseChord(e.name));
    if (!valid.length) return '';
    const first = valid.filter(e => e.off < half - EPS).pop();
    const second = valid.filter(e => e.off >= half - EPS).pop();
    if (first && second && canSplit(model, bar)) return joinSlots([first.name, second.name]);
    if (first) return first.name;
    return canSplit(model, bar) ? joinSlots(['', second.name]) : second.name;
  });
}

/** Resolve the chord sounding in each half of every bar ('' carried forward). */
export function resolveChords(model, values) {
  let prev = null;
  return model.bars.map((bar, i) => {
    const slots = barSlots(values[i]);
    const res = slots.map(s => {
      if (!s) return prev;
      if (s === NO_CHORD) { prev = null; return null; }
      const c = parseChord(s);
      if (c) prev = c;
      return c || prev;
    });
    return res.length === 1 ? [res[0], res[0]] : res;
  });
}
