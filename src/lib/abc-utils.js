const METERS = {
  'reel': '4/4',
  'hornpipe': '4/4',
  'polka': '2/4',
  'jig': '6/8',
  'slip jig': '9/8',
  'slide': '12/8',
  'waltz': '3/4',
  'mazurka': '3/4',
  'march': '4/4',
  'barndance': '4/4',
};

const DEFAULT_TEMPOS = {
  'reel': 120,
  'hornpipe': 80,
  'jig': 120,
  'slip jig': 120,
  'polka': 130,
  'slide': 130,
  'waltz': 90,
  'mazurka': 90,
  'march': 100,
  'barndance': 112,
};

export function getMeter(tuneType) {
  return METERS[tuneType] || '4/4';
}

export function getAbcMeter(abc) {
  const m = abc.match(/^M:\s*(\d+\/\d+)/m);
  return m ? m[1] : '4/4';
}

export function isCompoundMeter(timeSignature) {
  const [num, den] = timeSignature.split('/').map(Number);
  return den === 8 && num % 3 === 0;
}

export function getDefaultTempo(tuneType) {
  return DEFAULT_TEMPOS[tuneType] || 100;
}

export function parseAbcMeta(abc) {
  const field = (f) => { const m = abc.match(new RegExp(`^${f}:\\s*(.+)`, 'm')); return m ? m[1].trim() : null; };
  const title = field('T') || 'Untitled';
  const type = (field('R') || '').toLowerCase();
  const key = field('K') || '';
  const source = field('S') || '';
  const author = field('Z') || '';
  let session_id = null;
  let session_url = null;
  const sessionMatch = source.match(/thesession\.org\/tunes\/(\d+)/);
  if (sessionMatch) {
    session_id = Number(sessionMatch[1]);
    session_url = source;
  }
  return { title, type, key, source, author, session_id, session_url };
}

export function buildAbcString(title, tuneType, key, abc) {
  const meter = getMeter(tuneType);
  // If the ABC already has headers, strip transcription/source lines
  if (abc.trim().startsWith('X:')) {
    return abc.split('\n').filter(l => !/^[ZS]:/.test(l.trim())).join('\n');
  }
  // thesession.org uses "! " as line breaks in ABC — convert to newlines
  const body = abc.replace(/!\s*/g, '\n');
  return `X:1\nT:${title}\nM:${meter}\nL:1/8\nK:${key}\n${body}`;
}

// --- Chord annotation utilities ---

export function hasChordAnnotations(abc) {
  const body = abc.split('\n').filter(l => !/^[A-Za-z]:/.test(l.trim())).join('\n');
  return /"[A-G][^"]*?"/.test(body);
}

export function stripChordAnnotations(abc) {
  return abc.split('\n').map(line => {
    if (/^[A-Za-z]:/.test(line.trim())) return line;
    return line.replace(/"[A-G][^"]*?"/g, '');
  }).join('\n');
}

/**
 * Build a chords-only ABC string: keeps headers, chord annotations, bar lines,
 * and repeat markers, but replaces melody note pitches with rests.
 * Durations, accidentals modifiers, and everything else are preserved.
 */
export function chordsOnlyAbc(abc) {
  return abc.split('\n').map(line => {
    if (/^[A-Za-z]:/.test(line.trim()) || /^%/.test(line.trim()) || !line.trim()) {
      return line;
    }
    // Replace note pitches (with optional accidentals and octave markers) with z,
    // but skip anything inside chord annotations "..."
    return line.replace(/"[^"]*"|(\^{1,2}|_{1,2}|=)?([A-Ga-g])([',]*)/g, (match, acc, note, oct) => {
      // If it's a chord annotation (no note capture), keep as-is
      if (!note) return match;
      return 'z';
    });
  }).join('\n');
}

/**
 * Parse ABC body into an array of bar strings.
 * Handles |, ||, |:, :|, :: bar separators.
 */
export function parseAbcBars(abc) {
  const bodyLines = abc.split('\n').filter(l => {
    const t = l.trim();
    return t && !/^[A-Za-z]:/.test(t) && !/^%/.test(t);
  });
  const body = bodyLines.join(' ');
  // Split on bar lines, keeping content between them
  const bars = body.split(/\|{1,2}|:\||\|:|::/).map(s => s.trim()).filter(Boolean);
  return bars;
}

/**
 * Extract notes from a single bar of ABC content.
 * Returns array of { pitchClass, durationWeight } objects.
 * pitchClass is uppercase note name with accidental (e.g. "F#", "Bb", "C")
 */
export function extractBarNotes(barContent) {
  const notes = [];
  // Match: optional accidental, note letter, optional octave markers, optional duration
  const noteRe = /(\^{1,2}|_{1,2}|=)?([A-Ga-g])([',]*)(\d*\/?\.?\d*)/g;
  // Skip grace notes
  const cleaned = barContent.replace(/\{[^}]*\}/g, '');
  let match;
  while ((match = noteRe.exec(cleaned)) !== null) {
    const [, accidental, letter, , duration] = match;
    // Convert to pitch class
    let pc = letter.toUpperCase();
    if (accidental) {
      if (accidental.startsWith('^')) pc += '#';
      else if (accidental.startsWith('_')) pc += 'b';
    }
    // Parse duration weight (longer notes = more weight)
    let weight = 1;
    if (duration) {
      if (duration.includes('/')) {
        const parts = duration.split('/');
        weight = (Number(parts[0]) || 1) / (Number(parts[1]) || 2);
      } else {
        weight = Number(duration) || 1;
      }
    }
    notes.push({ pitchClass: pc, durationWeight: weight });
  }
  return notes;
}
