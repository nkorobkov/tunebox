import { Key, Note, Chord } from 'tonal';
import { parseAbcBars, extractBarNotes } from './abc-utils';

// Map ABC key notation to tonal-compatible key names
function normalizeKey(abcKey) {
  if (!abcKey) return { tonic: 'C', mode: 'major' };
  const m = abcKey.match(/^([A-G][b#]?)\s*(.*)/i);
  if (!m) return { tonic: 'C', mode: 'major' };
  const tonic = m[1][0].toUpperCase() + m[1].slice(1);
  const suffix = (m[2] || '').toLowerCase().trim();
  // Map ABC mode suffixes to tonal modes
  if (suffix.startsWith('min') || suffix === 'm') return { tonic, mode: 'minor' };
  if (suffix.startsWith('dor')) return { tonic, mode: 'dorian' };
  if (suffix.startsWith('mix')) return { tonic, mode: 'mixolydian' };
  if (suffix.startsWith('lyd')) return { tonic, mode: 'lydian' };
  if (suffix.startsWith('phr')) return { tonic, mode: 'phrygian' };
  if (suffix.startsWith('loc')) return { tonic, mode: 'locrian' };
  return { tonic, mode: 'major' };
}

// Build diatonic triads for a scale
function buildDiatonicChords(scaleNotes) {
  const pcs = scaleNotes.map(n => Note.pitchClass(n));
  const chords = [];
  for (let i = 0; i < pcs.length; i++) {
    const root = pcs[i];
    const third = pcs[(i + 2) % 7];
    const fifth = pcs[(i + 4) % 7];
    // Detect chord quality from intervals
    const thirdInterval = ((Note.chroma(third) - Note.chroma(root)) + 12) % 12;
    const fifthInterval = ((Note.chroma(fifth) - Note.chroma(root)) + 12) % 12;
    let symbol;
    if (thirdInterval === 4 && fifthInterval === 7) symbol = root; // major
    else if (thirdInterval === 3 && fifthInterval === 7) symbol = root + 'm'; // minor
    else if (thirdInterval === 3 && fifthInterval === 6) symbol = root + 'dim'; // diminished
    else if (thirdInterval === 4 && fifthInterval === 8) symbol = root + 'aug'; // augmented
    else symbol = root; // fallback
    chords.push({ symbol, notes: [root, third, fifth] });
  }
  return chords;
}

// Get scale notes for any mode
function getScaleNotes(tonic, mode) {
  if (mode === 'major') {
    const k = Key.majorKey(tonic);
    return k.scale;
  }
  if (mode === 'minor') {
    const k = Key.minorKey(tonic);
    return k.natural.scale;
  }
  // Modal scales: build from the parallel major
  const modeIntervals = {
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
  };
  const intervals = modeIntervals[mode];
  if (!intervals) {
    const k = Key.majorKey(tonic);
    return k.scale;
  }
  const rootChroma = Note.chroma(tonic);
  return intervals.map(i => {
    const chroma = (rootChroma + i) % 12;
    // Pick the simplest enharmonic name
    return Note.fromMidi(60 + chroma).replace(/\d+/, '');
  });
}

// Score a chord against a bar's note profile
function scoreChord(chord, noteProfile) {
  let score = 0;
  const chordChromas = new Set(chord.notes.map(n => Note.chroma(n)));
  for (const { chroma, weight } of noteProfile) {
    if (chordChromas.has(chroma)) score += weight;
  }
  return score;
}

/**
 * Generate chord annotations for an ABC string.
 * Returns a new ABC string with chord symbols injected at the start of each bar.
 */
export function generateChords(abc, key, meter) {
  const { tonic, mode } = normalizeKey(key);
  const scaleNotes = getScaleNotes(tonic, mode);
  const diatonicChords = buildDiatonicChords(scaleNotes);

  // Bias toward I, IV, V (indices 0, 3, 4) for folk tunes
  const PRIMARY_BIAS = 1.2;
  const primaryDegrees = new Set([0, 3, 4]);

  const bars = parseAbcBars(abc);

  const chordPerBar = bars.map(bar => {
    const notes = extractBarNotes(bar);
    if (notes.length === 0) return diatonicChords[0].symbol; // default to I

    // Build weighted pitch-class profile
    const noteProfile = notes.map(n => ({
      chroma: Note.chroma(n.pitchClass),
      weight: n.durationWeight,
    })).filter(n => n.chroma != null);

    let bestChord = diatonicChords[0].symbol;
    let bestScore = -1;

    diatonicChords.forEach((chord, degree) => {
      let score = scoreChord(chord, noteProfile);
      if (primaryDegrees.has(degree)) score *= PRIMARY_BIAS;
      // Penalize diminished chords heavily for folk music
      if (chord.symbol.includes('dim')) score *= 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestChord = chord.symbol;
      }
    });

    return bestChord;
  });

  // Inject chords into the ABC string
  return injectChords(abc, chordPerBar);
}

/**
 * Inject chord symbols into ABC at the start of each bar.
 */
function injectChords(abc, chords) {
  const lines = abc.split('\n');
  let barIndex = 0;
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip header lines and comments
    if (/^[A-Za-z]:/.test(trimmed) || /^%/.test(trimmed) || !trimmed) {
      result.push(line);
      continue;
    }

    // Process a body line: split into segments by bar lines
    let processed = '';
    let i = 0;
    let atLineStart = true;

    while (i < line.length) {
      // Check for bar line characters
      if (line[i] === '|' || (line[i] === ':' && i + 1 < line.length && line[i + 1] === '|')) {
        // Emit the bar line as-is
        if (line[i] === ':') {
          processed += ':|';
          i += 2;
        } else if (i + 1 < line.length && line[i + 1] === ':') {
          processed += '|:';
          i += 2;
        } else if (i + 1 < line.length && line[i + 1] === '|') {
          processed += '||';
          i += 2;
        } else {
          processed += '|';
          i += 1;
        }
        atLineStart = true;
        continue;
      }

      // At the start of a bar segment, inject the chord
      if (atLineStart && barIndex < chords.length) {
        // Skip leading whitespace
        while (i < line.length && line[i] === ' ') {
          processed += ' ';
          i++;
        }
        if (i < line.length && line[i] !== '|' && line[i] !== ':') {
          processed += `"${chords[barIndex]}"`;
          barIndex++;
          atLineStart = false;
        }
        continue;
      }

      processed += line[i];
      i++;
      atLineStart = false;
    }

    result.push(processed);
  }

  return result.join('\n');
}
