// Lazy pdf.js wrapper for the file-import flow. Like the OCR module, nothing
// loads until the first PDF is picked, and all runtime assets (worker, wasm
// image decoders, fallback fonts) are served from /pdfjs on our own origin
// (copied from node_modules by scripts/copy-vendor-assets.mjs) — the CSP
// blocks CDNs, and isEvalSupported must be false (no 'unsafe-eval').

let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      return pdfjs;
    });
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

export function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

// Cluster text items into visual lines by baseline y, top of page first,
// in the shape extractTitleFromLines expects (bbox y grows downward).
function itemsToLines(items, pageHeight) {
  const rows = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const ty = it.transform[5];
    const h = it.height || Math.abs(it.transform[3]) || 10;
    let row = rows.find(r => Math.abs(r.ty - ty) < h * 0.5);
    if (!row) { row = { ty, h, items: [] }; rows.push(row); }
    row.h = Math.max(row.h, h);
    row.items.push(it);
  }
  rows.sort((a, b) => b.ty - a.ty);
  return rows.map(r => ({
    text: r.items.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(),
    confidence: 100, // real text layer, not OCR
    bbox: { y0: pageHeight - r.ty - r.h, y1: pageHeight - r.ty },
  }));
}

async function renderToBlob(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Analyze page 1 of a PDF: extract text-layer lines (for the title
 * heuristic) and render a small thumbnail. When there is no usable text
 * layer (scanned PDF), also render the page big enough for OCR — the
 * caller feeds `scanBlob` through recognizeLines instead.
 * @returns {Promise<{lines: Array, thumb: Blob|null, scanBlob: Blob|null}>}
 */
export async function analyzePdf(file) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    isEvalSupported: false,
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const lines = itemsToLines(content.items, viewport.height);

    const thumb = await renderToBlob(page, 320 / viewport.width).catch(() => null);

    let scanBlob = null;
    const textChars = lines.reduce((n, l) => n + l.text.length, 0);
    if (textChars < 10) {
      // ~300dpi-ish rendering, same ceiling the OCR module uses for photos
      const scale = Math.min(2500 / Math.max(viewport.width, viewport.height), 4);
      scanBlob = await renderToBlob(page, scale).catch(() => null);
    }
    return { lines, thumb, scanBlob };
  } finally {
    task.destroy();
  }
}
