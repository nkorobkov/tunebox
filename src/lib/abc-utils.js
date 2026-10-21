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

/**
 * Inject or replace Q: tempo header in ABC string so abcjs uses it natively.
 */
export function setAbcTempo(abc, qpm) {
  // If ABC already has a Q: field, replace it
  if (/^Q:/m.test(abc)) {
    return abc.replace(/^Q:.*$/m, `Q:1/4=${qpm}`);
  }
  // Insert Q: after K: line (key is typically the last header before the body)
  return abc.replace(/^(K:.*)$/m, `$1\nQ:1/4=${qpm}`);
}

export function buildAbcString(title, tuneType, key, abc) {
  const meter = getMeter(tuneType);
  // If the ABC already has headers, strip transcription/source lines
  if (/^X:/m.test(abc)) {
    return abc.split('\n').filter(l => !/^[ZS]:/.test(l.trim())).join('\n');
  }
  // thesession.org uses "! " as line breaks in ABC — convert to newlines
  const body = abc.replace(/!\s*/g, '\n');
  return `X:1\nT:${title}\nM:${meter}\nL:1/8\nK:${key}\n${body}`;
}

const SECTION_END = /thin_thin|thin_thick|thick_thin/;

/**
 * abcjs only starts a repeat at `|:` (or the top of the tune), so a part that
 * closes with `:|` but never opens with `|:` — common after `|1 … :|2 … ||` —
 * is swallowed into the previous part's last ending and played once. Treat
 * the last `||` (or end of an ending) before such a `:|` as the opening
 * repeat instead. Mutates the parsed tune's bar types only (audio expansion;
 * startChars and the drawn notation are untouched). Call before setUpAudio.
 */
export function openImplicitRepeats(tune) {
  const voices = new Map();
  for (const line of tune?.lines || []) {
    (line.staff || []).forEach((staff, s) => {
      (staff.voices || []).forEach((voice, v) => {
        const id = `${s}:${v}`;
        const state = voices.get(id) || { open: false, boundary: null };
        voices.set(id, state);
        for (const el of voice) {
          if (el.el_type !== 'bar') continue;
          const type = el.type || '';
          if (/right_repeat|dbl_repeat/.test(type)) {
            if (!state.open && state.boundary) state.boundary.type = 'bar_left_repeat';
            state.open = /dbl_repeat/.test(type);
            state.boundary = null;
          } else if (/left_repeat/.test(type)) {
            state.open = true;
            state.boundary = null;
          } else if (SECTION_END.test(type) || el.endEnding) {
            state.boundary = el;
          }
        }
      });
    });
  }
  return tune;
}
