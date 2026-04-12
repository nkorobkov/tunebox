const METERS = {
  'reel': '4/4',
  'hornpipe': '4/4',
  'polka': '2/4',
  'jig': '6/8',
  'slip jig': '9/8',
  'slide': '12/8',
  'waltz': '3/4',
  'mazurka': '3/4',
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
};

export function getMeter(tuneType) {
  return METERS[tuneType] || '4/4';
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
  // If the ABC already has headers, return as-is
  if (abc.trim().startsWith('X:')) return abc;
  // thesession.org uses "! " as line breaks in ABC — convert to newlines
  const body = abc.replace(/!\s*/g, '\n');
  return `X:1\nT:${title}\nM:${meter}\nL:1/8\nK:${key}\n${body}`;
}
