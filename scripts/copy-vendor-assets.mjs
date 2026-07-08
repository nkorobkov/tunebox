// Copies the tesseract.js and pdf.js runtime assets from node_modules into
// public/tesseract/ and public/pdfjs/ (both gitignored). Runs on postinstall
// so the files always match the installed package versions. They must be
// served from our own origin: the CSP blocks CDN script/wasm/data loads.
// Everything here is lazy-fetched by the browser on first use, never precached.
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (p) => join(root, 'node_modules', p);

// tesseract.js — OCR for the file-import flow
const tessDest = join(root, 'public', 'tesseract');
mkdirSync(tessDest, { recursive: true });
const tessAssets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // SIMD + LSTM-only core: right variant for every browser this app supports
  // (wasm SIMD: Chrome 91+, Firefox 89+, Safari 16.4+) with OEM 1 (LSTM).
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
for (const [src, name] of tessAssets) copyFileSync(nm(src), join(tessDest, name));

// pdf.js — PDF text extraction / page rendering for the file-import flow
const pdfDest = join(root, 'public', 'pdfjs');
mkdirSync(pdfDest, { recursive: true });
copyFileSync(nm('pdfjs-dist/build/pdf.worker.min.mjs'), join(pdfDest, 'pdf.worker.min.mjs'));
// Image decoders (JPX/JBIG2 in scanned PDFs), color management, fallback
// fonts — pdf.js fetches individual files from these dirs only when a
// document needs them.
cpSync(nm('pdfjs-dist/wasm'), join(pdfDest, 'wasm'), { recursive: true });
cpSync(nm('pdfjs-dist/iccs'), join(pdfDest, 'iccs'), { recursive: true });
cpSync(nm('pdfjs-dist/standard_fonts'), join(pdfDest, 'standard_fonts'), { recursive: true });

console.log('Copied tesseract + pdfjs assets into public/');
