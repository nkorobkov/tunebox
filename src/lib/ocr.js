// Lazy tesseract.js wrapper. Nothing (library code, worker, wasm core,
// language data — ~11MB total) loads until the first recognize call. The
// runtime assets are served from /tesseract on our own origin (copied from
// node_modules by scripts/copy-tesseract.mjs) because the CSP blocks CDNs;
// wasm needs 'wasm-unsafe-eval' in script-src.

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1 /* OEM 1 = LSTM, matches the simd-lstm core */, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
        langPath: '/tesseract',
        // Default is a blob:-URL wrapper worker, which the CSP forbids;
        // loading the same-origin worker script directly is script-src 'self'.
        workerBlobURL: false,
      })
    );
    // Let a failed init (offline, missing assets) be retried later.
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

// Tesseract targets ~300dpi scans; phone photos are much bigger and only
// slow it down. Decode + downscale through a canvas; this also converts
// formats leptonica can't parse (e.g. HEIC on Safari). Falls back to the
// original file when decoding fails — tesseract handles png/jpg/gif/bmp.
const MAX_DIM = 2500;

async function prepareImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs would OCR as black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return blob || file;
  } catch {
    return file;
  }
}

/**
 * OCR an image file and return recognized text lines. Serialize calls —
 * a single worker handles one job at a time.
 * @returns {Promise<Array<{text: string, confidence: number, bbox: object}>>}
 */
export async function recognizeLines(file) {
  const worker = await getWorker();
  const image = await prepareImage(file);
  const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
  const lines = [];
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        lines.push({
          text: line.text.replace(/\s+/g, ' ').trim(),
          confidence: line.confidence,
          bbox: line.bbox,
        });
      }
    }
  }
  return lines;
}

/** Free the worker (~100MB of wasm heap). Next recognize call restarts it. */
export async function releaseOcrWorker() {
  if (!workerPromise) return;
  const p = workerPromise;
  workerPromise = null;
  try {
    (await p).terminate();
  } catch {
    // init already failed — nothing to release
  }
}
