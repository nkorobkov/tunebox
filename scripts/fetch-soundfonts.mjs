// One-off downloader for the self-hosted soundfont samples used by the
// generated backing track (src/lib/backing/). Like the piano that was already
// here, the output is committed to public/soundfonts/FluidR3_GM/ so playback
// works offline and nothing is fetched from a third-party origin at runtime.
//
// Only the pitch ranges the arranger actually produces are fetched (see the
// range clamps in src/lib/backing/arrange.js); abcjs silently skips a note
// whose sample is missing, so widen a range here before widening it there.
//
//   node scripts/fetch-soundfonts.mjs
//
// FluidR3's percussion folder holds the same placeholder sample for every
// note, so drums come from abcjs's own maintained percussion set instead.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dest = join(root, 'public', 'soundfonts', 'FluidR3_GM');
const BASE = 'https://paulrosen.github.io/midi-js-soundfonts';

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const SETS = [
  { name: 'acoustic_bass', src: 'FluidR3_GM', pitches: range(28, 55) },
  { name: 'acoustic_guitar_steel', src: 'FluidR3_GM', pitches: range(40, 76) },
  { name: 'acoustic_guitar_nylon', src: 'FluidR3_GM', pitches: range(40, 76) },
  { name: 'violin', src: 'FluidR3_GM', pitches: range(55, 100) },
  { name: 'flute', src: 'FluidR3_GM', pitches: range(60, 96) },
  // bodhrán (low floor tom 41, high floor tom 43, low tom 45), side stick 37
  // (the count-in uses the metronome's synthesized click, not a sample)
  { name: 'percussion', src: 'abcjs', pitches: [37, 41, 43, 45, 47] },
];

let fetched = 0;
for (const set of SETS) {
  const dir = join(dest, `${set.name}-mp3`);
  mkdirSync(dir, { recursive: true });
  for (const p of set.pitches) {
    const file = join(dir, `${noteName(p)}.mp3`);
    if (existsSync(file)) continue;
    const url = `${BASE}/${set.src}/${set.name}-mp3/${noteName(p)}.mp3`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
}
console.log(`Fetched ${fetched} samples into ${dest}`);
