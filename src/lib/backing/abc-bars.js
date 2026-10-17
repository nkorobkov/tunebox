import abcjs from 'abcjs';

// The bar model behind generated backing: one entry per *written* bar of the
// first voice, in notation order (repeats are not expanded — a repeated part
// replays the same bars, so it replays the same chords). Chords are stored per
// bar index, which is why the model, not the ABC text, is the identity of a
// bar: see chords.js for the per-bar chord format.

const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC_OFFSET = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2, quarterflat: 0, quartersharp: 0 };
const EPS = 1e-6;

const MODE_ALIASES = {
  '': 'major', maj: 'major', major: 'major', ion: 'major', ionian: 'major', lyd: 'major', lydian: 'major',
  m: 'minor', min: 'minor', minor: 'minor', aeo: 'minor', aeolian: 'minor', phr: 'minor', phrygian: 'minor', loc: 'minor', locrian: 'minor',
  dor: 'dorian', dorian: 'dorian',
  mix: 'mixolydian', mixolydian: 'mixolydian',
};

function readKey(key) {
  const signature = {};
  let flats = false;
  for (const a of key?.accidentals || []) {
    const letter = (a.note || '').toUpperCase();
    if (!(letter in LETTER_PC)) continue;
    signature[letter] = ACC_OFFSET[a.acc] ?? 0;
    if (a.acc === 'flat' || a.acc === 'dblflat') flats = true;
  }
  let tonicPc = null;
  if (key?.root && key.root in LETTER_PC) {
    tonicPc = (LETTER_PC[key.root] + (key.acc === '#' ? 1 : key.acc === 'b' ? -1 : 0) + 12) % 12;
    if (key.acc === 'b') flats = true;
  }
  const mode = MODE_ALIASES[(key?.mode || '').toLowerCase()] || 'major';
  // K:none / K:HP — no tonic; fall back to the major key of the signature.
  if (tonicPc === null) tonicPc = 0;
  return { tonicPc, mode, signature, flats };
}

function pitchClass(pitch, accidental, key, barAcc) {
  const step = ((pitch % 7) + 7) % 7;
  const letter = 'CDEFGAB'[step];
  let offset;
  if (accidental && accidental in ACC_OFFSET) {
    offset = ACC_OFFSET[accidental];
    barAcc.set(pitch, offset);
  } else if (barAcc.has(pitch)) {
    offset = barAcc.get(pitch);
  } else {
    offset = key.signature[letter] || 0;
  }
  return ((STEP_SEMITONES[step] + offset) % 12 + 12) % 12;
}

/**
 * Parse ABC into bars. Returns null when there is nothing playable.
 *
 * bar: { index, length (whole notes), notes: [{pc, dur, off}], elements:
 *   [{startChar, off}] (notes and rests, for chord placement), key, part,
 *   pickup, partial, ending ('1', '2', … or null), existing: [{name, off}] }
 * model: { bars, meter, barLength, key (first), parts, charMap }
 */
export function parseBars(abc) {
  if (!abc) return null;
  let tune;
  try {
    tune = abcjs.parseOnly(abc)[0];
  } catch {
    return null;
  }
  if (!tune?.lines) return null;

  const meterFraction = tune.getMeterFraction?.() || { num: 4, den: 4 };
  const meter = { num: meterFraction.num || 4, den: meterFraction.den || 4 };
  const barLength = tune.getBarLength?.() || meter.num / meter.den;

  const bars = [];
  const charMap = new Map();
  let key = null;
  let current = null;
  let barAcc = new Map();
  let tripletMult = 1;
  let part = 0;
  let partPending = false;
  let partLabel = null;
  const partLabels = [];
  let pendingEnding = null;

  const startBar = () => {
    if (current) return current;
    // (a 2nd ending after `:|` continues the same part)
    if (bars.length > 0 && partPending && !pendingEnding) part++;
    partPending = false;
    if (partLabels[part] === undefined) partLabels[part] = partLabel;
    partLabel = null;
    current = {
      index: bars.length, length: 0, notes: [], elements: [], key, part,
      pickup: false, partial: false, ending: pendingEnding, existing: [],
    };
    pendingEnding = null;
    return current;
  };

  const closeBar = () => {
    if (!current) return;
    if (current.length > EPS || current.notes.length) bars.push(current);
    current = null;
    barAcc = new Map();
  };

  for (const line of tune.lines) {
    const staff = line.staff?.[0];
    if (!staff) continue;
    if (staff.key) key = readKey(staff.key);
    const voice = staff.voices?.[0] || [];
    for (const el of voice) {
      switch (el.el_type) {
        case 'key':
          key = readKey(el);
          if (current) current.key = key;
          break;
        case 'part':
          partPending = true;
          partLabel = el.title || null;
          break;
        case 'bar': {
          const type = el.type || '';
          closeBar();
          const last = bars[bars.length - 1];
          if (last && /right_repeat|dbl_repeat|thin_thin|thin_thick|thick_thin/.test(type)) partPending = true;
          // (`A|:` — the repeat after a pickup still opens the first part)
          const afterPickup = bars.length === 1 && last.length < barLength - EPS;
          if (/left_repeat/.test(type) && last && !last.ending && !afterPickup) partPending = true;
          if (el.startEnding) pendingEnding = String(el.startEnding);
          break;
        }
        case 'note': {
          if (el.duration === undefined) break;
          const bar = startBar();
          if (el.startTriplet) tripletMult = el.tripletMultiplier || 1;
          const dur = el.duration * tripletMult;
          if (el.endTriplet) tripletMult = 1;
          if (el.startChar !== undefined) {
            bar.elements.push({ startChar: el.startChar, off: bar.length });
            charMap.set(el.startChar, { bar: bar.index, off: bar.length });
          }
          for (const ch of el.chord || []) {
            if (ch.position === 'default' && ch.name) bar.existing.push({ name: ch.name.trim(), off: bar.length });
          }
          if (!el.rest && Array.isArray(el.pitches)) {
            for (const p of el.pitches) {
              if (!p) continue;
              bar.notes.push({ pc: pitchClass(p.pitch, p.accidental, bar.key || key, barAcc), dur, off: bar.length });
            }
          }
          bar.length += dur;
          break;
        }
        default:
          break;
      }
    }
  }
  closeBar();
  if (!bars.length) return null;

  for (const bar of bars) {
    bar.length = Math.round(bar.length * 1e6) / 1e6;
    bar.partial = bar.length < barLength - EPS;
    if (!bar.key) bar.key = bars.find(b => b.key)?.key || readKey(null);
  }
  bars[0].pickup = bars[0].partial;

  const parts = [];
  for (const bar of bars) {
    const p = parts[bar.part] || (parts[bar.part] = { index: bar.part, label: partLabels[bar.part] || null, bars: [] });
    p.bars.push(bar.index);
  }
  parts.forEach((p, i) => { if (!p.label) p.label = String.fromCharCode(65 + i); });

  return { bars, meter, barLength, key: bars[0].key, parts, charMap };
}

// Chord text that abcjs treats as a chord symbol rather than an annotation
// (annotations start with ^ _ < > @).
const CHORD_TEXT = /"([^"^_<>@][^"]*)"/g;

/** Remove chord symbols from the tune body (header lines untouched). */
export function stripChordSymbols(abc) {
  return abc.split('\n').map(line => (/^[A-Za-z]:/.test(line) || /^%/.test(line)) ? line : line.replace(CHORD_TEXT, '')).join('\n');
}

/**
 * Write per-bar chords into ABC as chord symbols, for the notation view only
 * (playback never goes through chord symbols). Existing symbols are replaced.
 */
export function injectChordSymbols(abc, chordsForBar) {
  const stripped = stripChordSymbols(abc);
  const model = parseBars(stripped);
  if (!model) return abc;
  const inserts = [];
  model.bars.forEach((bar, i) => {
    const slots = chordsForBar(i, bar);
    if (!slots) return;
    slots.forEach(({ name, off }) => {
      if (!name) return;
      const el = bar.elements.find(e => e.off >= off - EPS);
      if (el) inserts.push({ at: el.startChar, text: `"${name}"` });
    });
  });
  inserts.sort((a, b) => b.at - a.at);
  let out = stripped;
  for (const { at, text } of inserts) out = out.slice(0, at) + text + out.slice(at);
  return out;
}
