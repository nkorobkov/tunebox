// Rhythm patterns for generated backing, one character per eighth note of the
// bar (so a reel bar has 8, a jig bar 6, a slip jig 9…). A pattern whose length
// doesn't match the bar falls back to one hit per beat.
//
// Strum:  D accented down-strum   d down-strum   U accented up-strum   u up-strum
//         B bass string alone     . let it ring
// Piano:  b left-hand bass        c chord        C accented chord      . rest
// Drum:   X accent (bodhrán low)  x stroke       o light tip           . rest

const ADD = ['hornpipe', 'barndance', 'strathspey', 'march', 'fling', 'schottische', 'highland'];

/** The rhythm family a tune's backing follows, from its meter and type. */
export function rhythmFamily(meter, tuneType) {
  const { num, den } = meter;
  const type = (tuneType || '').toLowerCase();
  if (den === 8 && num === 6) return 'jig';
  if (den === 8 && num === 9) return 'slip';
  if (den === 8 && num === 12) return 'slide';
  if (num === 3 && den === 4) return 'waltz';
  if (num === 2 && den === 4) return 'polka';
  if (num === 3 && den === 2) return 'threetwo';
  if ((num === 4 && den === 4) || (num === 2 && den === 2)) return ADD.includes(type) ? 'hornpipe' : 'reel';
  return 'generic';
}

export const FAMILY_LABELS = {
  reel: 'Reel', hornpipe: 'Hornpipe', jig: 'Jig', slip: 'Slip jig', slide: 'Slide',
  polka: 'Polka', waltz: 'Waltz', threetwo: 'Three-two', generic: 'Other',
};

/** Eighth-note slots of the beats, and of the bass's main pulses. */
export function beatSlots(family, slots) {
  switch (family) {
    case 'reel': case 'hornpipe': return { beats: [0, 2, 4, 6], pulses: [0, 4] };
    case 'jig': return { beats: [0, 3], pulses: [0, 3] };
    case 'slip': return { beats: [0, 3, 6], pulses: [0, 3, 6] };
    case 'slide': return { beats: [0, 3, 6, 9], pulses: [0, 6] };
    case 'polka': return { beats: [0, 2], pulses: [0, 2] };
    case 'waltz': return { beats: [0, 2, 4], pulses: [0] };
    case 'threetwo': return { beats: [0, 4, 8], pulses: [0, 4, 8] };
    default: {
      const step = slots % 3 === 0 && slots > 4 ? 3 : 2;
      const beats = [];
      for (let s = 0; s < slots; s += step) beats.push(s);
      return { beats, pulses: [0] };
    }
  }
}

export const STRUM_PATTERNS = {
  reel: [
    { id: 'steady', label: 'Steady', pattern: 'DuduDudu' },
    { id: 'lift', label: 'Lift', pattern: 'D.dU.udu' },
    { id: 'push', label: 'Push (3-3-2)', pattern: 'D.uD.uDu' },
    { id: 'sparse', label: 'Sparse', pattern: 'D...D...' },
  ],
  hornpipe: [
    { id: 'steady', label: 'Steady', pattern: 'D.duD.du' },
    { id: 'backbeat', label: 'Backbeat', pattern: 'B.D.B.D.' },
    { id: 'sparse', label: 'Sparse', pattern: 'D...D...' },
  ],
  jig: [
    { id: 'steady', label: 'Steady', pattern: 'D.uD.u' },
    { id: 'drive', label: 'Driving', pattern: 'DudDud' },
    { id: 'push', label: 'Push', pattern: 'D.dU.u' },
    { id: 'sparse', label: 'Sparse', pattern: 'D..D..' },
  ],
  slip: [
    { id: 'steady', label: 'Steady', pattern: 'D.uD.uD.u' },
    { id: 'sparse', label: 'Sparse', pattern: 'D..D..D..' },
  ],
  slide: [
    { id: 'steady', label: 'Steady', pattern: 'D.uD.uD.uD.u' },
    { id: 'sparse', label: 'Sparse', pattern: 'D..d..D..d..' },
  ],
  polka: [
    { id: 'offbeat', label: 'Bass & chop', pattern: 'BDBD' },
    { id: 'steady', label: 'Steady', pattern: 'DuDu' },
    { id: 'sparse', label: 'Sparse', pattern: 'D.D.' },
  ],
  waltz: [
    { id: 'waltz', label: 'Bass & two', pattern: 'B.D.D.' },
    { id: 'steady', label: 'Steady', pattern: 'D.D.D.' },
    { id: 'sparse', label: 'Sparse', pattern: 'D.....' },
  ],
  threetwo: [
    { id: 'steady', label: 'Steady', pattern: 'D.u.D.u.D.u.' },
    { id: 'sparse', label: 'Sparse', pattern: 'D...D...D...' },
  ],
  generic: [{ id: 'beats', label: 'Strum on the beat', pattern: '' }],
};

export const PIANO_PATTERNS = {
  reel: [
    { id: 'vamp', label: 'Boom-chick', pattern: 'b.c.b.c.' },
    { id: 'offbeat', label: 'Off-beats', pattern: 'b.cCb.cC' },
  ],
  hornpipe: [
    { id: 'vamp', label: 'Boom-chick', pattern: 'b.c.b.c.' },
  ],
  jig: [
    { id: 'vamp', label: 'Boom-chick', pattern: 'b.cb.c' },
    { id: 'full', label: 'Full', pattern: 'bccbcc' },
  ],
  slip: [{ id: 'vamp', label: 'Boom-chick', pattern: 'b.cb.cb.c' }],
  slide: [{ id: 'vamp', label: 'Boom-chick', pattern: 'b.cb.cb.cb.c' }],
  polka: [{ id: 'vamp', label: 'Boom-chick', pattern: 'bcbc' }],
  waltz: [{ id: 'vamp', label: 'Oom-pah-pah', pattern: 'b.c.c.' }],
  threetwo: [{ id: 'vamp', label: 'Boom-chick', pattern: 'b.c.b.c.b.c.' }],
  generic: [{ id: 'beats', label: 'Piano on the beat', pattern: '' }],
};

export const DRUM_PATTERNS = {
  reel: 'XoxoXoxo',
  hornpipe: 'X.xoX.xo',
  jig: 'XoxXox',
  slip: 'XoxXoxXox',
  slide: 'XoxXoxXoxXox',
  polka: 'XoXo',
  waltz: 'X.x.x.',
  threetwo: 'X.x.X.x.X.x.',
};

/** Pattern (string) for a family, falling back to one hit per beat. */
export function patternFor(table, family, id, slots, beatChar) {
  const list = table[family] || table.generic;
  const pick = list.find(p => p.id === id) || list[0];
  if (pick.pattern && pick.pattern.length === slots) return pick.pattern;
  const { beats } = beatSlots(family, slots);
  return Array.from({ length: slots }, (_, s) => (beats.includes(s) ? beatChar : '.')).join('');
}

export function drumPatternFor(family, slots) {
  const p = DRUM_PATTERNS[family];
  if (p && p.length === slots) return p;
  const { beats } = beatSlots(family, slots);
  return Array.from({ length: slots }, (_, s) => (s === 0 ? 'X' : beats.includes(s) ? 'x' : '.')).join('');
}

// Swing, as abcjs's percentage: 50 straight, 66 triplet feel.
export const SWING_LEVELS = [
  { id: 'off', label: 'Off', value: 50 },
  { id: 'light', label: 'Light', value: 56 },
  { id: 'medium', label: 'Medium', value: 62 },
  { id: 'heavy', label: 'Heavy', value: 67 },
];

const AUTO_SWING = { reel: 'light', hornpipe: 'medium', polka: 'light' };

export function swingValue(setting, family) {
  const id = setting === 'auto' ? (AUTO_SWING[family] || 'off') : setting;
  return (SWING_LEVELS.find(s => s.id === id) || SWING_LEVELS[0]).value;
}

export function swingSupported(family) {
  return ['reel', 'hornpipe', 'polka', 'waltz', 'threetwo'].includes(family);
}
