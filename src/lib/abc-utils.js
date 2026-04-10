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

export function buildAbcString(title, tuneType, key, abc) {
  const meter = getMeter(tuneType);
  // If the ABC already has headers, return as-is
  if (abc.trim().startsWith('X:')) return abc;
  return `X:1\nT:${title}\nM:${meter}\nL:1/8\nK:${key}\n${abc}`;
}
