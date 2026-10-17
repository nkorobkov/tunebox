// The generated-backing mix and arrangement settings. They are global (one
// sound for every tune) and per device, kept in localStorage; only a tune's
// chords are saved to its record.

const STORAGE_KEY = 'tunebox.backing';

export const INSTRUMENTS = {
  piano: { program: 0, label: 'Piano' },
  steel: { program: 25, label: 'Steel guitar' },
  nylon: { program: 24, label: 'Nylon guitar' },
  fiddle: { program: 40, label: 'Fiddle' },
  flute: { program: 73, label: 'Flute' },
};
export const BASS_PROGRAM = 32;

// Strum patterns play on a guitar; piano patterns always play on the piano.
export const GUITARS = ['steel', 'nylon'];
export const MELODY_INSTRUMENTS = ['piano', 'fiddle', 'flute'];

// A layer is off when its volume is 0 — the settings rows and the mix
// sliders are two views of the same value. `lastVolumes` remembers the level
// to come back to when a layer is switched on again.
export const DEFAULT_PREFS = {
  chordStyle: 'strum',          // strum | piano
  chordInstrument: 'steel',     // guitar for the strum patterns: steel | nylon
  strumPatterns: {},            // family -> pattern id
  pianoPatterns: {},
  bass: 'rootFifth',            // root | rootFifth | walking
  drone: 'tonic',               // tonic | fifth
  swing: 'auto',                // auto | off | light | medium | heavy
  melody: 'piano',              // piano | fiddle | flute
  volumes: { melody: 60, chords: 75, bass: 70, drums: 55, drone: 0 },
  lastVolumes: { melody: 60, chords: 75, bass: 70, drums: 55, drone: 35 },
  countIn: true,
  loop: true,
};

// Earlier versions kept "off" in the style fields; fold that into volume 0.
function normalize(saved) {
  const p = {
    ...DEFAULT_PREFS,
    ...saved,
    volumes: { ...DEFAULT_PREFS.volumes, ...(saved.volumes || {}) },
    lastVolumes: { ...DEFAULT_PREFS.lastVolumes, ...(saved.lastVolumes || {}) },
  };
  const off = (layer) => {
    if (p.volumes[layer] > 0) p.lastVolumes[layer] = p.volumes[layer];
    p.volumes[layer] = 0;
  };
  if (p.chordStyle === 'off') { p.chordStyle = 'strum'; off('chords'); }
  if (p.bass === 'off') { p.bass = 'rootFifth'; off('bass'); }
  if (p.drums === false) off('drums');
  if (p.drone === 'off') { p.drone = 'tonic'; off('drone'); }
  delete p.drums;
  if (!GUITARS.includes(p.chordInstrument)) p.chordInstrument = 'steel';
  return p;
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // private mode / storage full — settings just won't persist
  }
}
