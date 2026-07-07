import abcjs from 'abcjs';
import { pb } from './pb';
import { buildAbcString } from './abc-utils';
import { describeTuneData } from './export-utils';
import { getFileUrl, isImage } from '../hooks/use-attachments';

// A4 in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const FOOTER_H = 24;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2 - FOOTER_H;
const TUNE_GAP = 28;
// Staff width abcjs renders at; scaling down to CONTENT_W gives ~0.8× music size.
const RENDER_W = 620;
const NOTES_FONT = 9;
const NOTES_LINE_H = 12;

async function fetchMainSheetMusic(tuneId) {
  const res = await pb.collection('attachments').getList(1, 100, {
    filter: `user_tune = "${tuneId}"`,
  });
  return res.items.find(a => a.main_source && a.type === 'sheet_music') || null;
}

/**
 * Fetch an image and re-encode it as JPEG via canvas — normalizes formats
 * jsPDF can't embed (webp/gif/svg) and flattens transparency onto white.
 * Goes through fetch + blob URL so the canvas is never CORS-tainted.
 */
async function loadImageAsJpeg(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
  const blobUrl = URL.createObjectURL(await resp.blob());
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = blobUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Generate a tunebook PDF from a list of tunes.
 * Layout is computed up front (render + measure every tune), so when the
 * index is included its page numbers are exact.
 *
 * Tunes without ABC use their main-source sheet-music attachment when it's
 * an embeddable image; otherwise a text block describing the tune.
 * `skipNoNotation` drops tunes that have neither ABC nor a main attachment.
 *
 * @returns {Promise<Blob>} the PDF file
 */
export async function generateTunebookPdf(tunes, { includeIndex = true, includeNotes = false, skipNoNotation = false } = {}, onProgress) {
  const { jsPDF } = await import('jspdf');
  await import('svg2pdf.js'); // registers doc.svg()

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // Offscreen container for abcjs rendering — must be in the DOM to measure.
  const container = document.createElement('div');
  // color:#000 — abcjs SVGs use currentColor; without it dark mode's light
  // text color would leak into the exported PDF.
  container.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_W + 20}px;color:#000;`;
  document.body.appendChild(container);

  try {
    // --- Phase 1: render + measure every tune ---
    let blocks = [];
    for (const [i, tune] of tunes.entries()) {
      onProgress?.(`Rendering ${i + 1}/${tunes.length}: ${tune.title}`);
      const block = { tune, svg: null, svgW: 0, svgH: 0, img: null, imgW: 0, imgH: 0, textLines: [], notesLines: [], hasAttachment: false };

      if (tune.abc) {
        const div = document.createElement('div');
        container.appendChild(div);
        // No abcjs `scale` option here: it scales via a CSS transform that
        // svg2pdf ignores (which clips the output). Render at scale 1 and
        // let svg2pdf do the scaling through the viewBox instead.
        abcjs.renderAbc(div, buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc), {
          staffwidth: RENDER_W,
          paddingtop: 0,
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
        });
        const svg = div.querySelector('svg');
        if (svg) {
          const w = parseFloat(svg.getAttribute('width'));
          const h = parseFloat(svg.getAttribute('height'));
          if (w > 0 && h > 0) {
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
            const fit = Math.min(CONTENT_W / w, CONTENT_H / h);
            block.svg = svg;
            block.svgW = w * fit;
            block.svgH = h * fit;
          }
        }
      } else {
        let main = null;
        try {
          main = await fetchMainSheetMusic(tune.id);
        } catch (err) {
          console.warn(`Attachment lookup failed for "${tune.title}":`, err);
        }
        block.hasAttachment = !!main;
        if (main && isImage(main.file)) {
          try {
            const img = await loadImageAsJpeg(getFileUrl(main));
            const fit = Math.min(CONTENT_W / img.w, (CONTENT_H - 22) / img.h);
            block.img = img;
            block.imgW = img.w * fit;
            block.imgH = img.h * fit;
          } catch (err) {
            console.warn(`Could not embed sheet music image for "${tune.title}":`, err);
          }
        }
        if (!block.img) {
          block.leadLine = main
            ? `Sheet music attachment: ${main.label || main.file} (cannot be embedded in PDF)`
            : 'No sheet music stored in Tunebox.';
          // Notes are handled by the includeNotes block below, like ABC tunes.
          block.textLines = describeTuneData(tune).filter(l => !l.startsWith('Note:'));
        }
      }

      if (includeNotes && tune.notes) {
        doc.setFontSize(NOTES_FONT);
        block.notesLines = doc.splitTextToSize(tune.notes, CONTENT_W);
      }
      blocks.push(block);
    }

    if (skipNoNotation) {
      blocks = blocks.filter(b => b.svg || b.hasAttachment);
      if (blocks.length === 0) {
        const err = new Error('None of the selected tunes have sheet music (ABC or main attachment).');
        err.friendly = true;
        throw err;
      }
    }

    onProgress?.('Laying out pages...');

    const blockHeight = (b) => {
      let h;
      if (b.svg) h = b.svgH;
      else if (b.img) h = 22 + b.imgH; // title + image
      else h = 22 + 14 + b.textLines.length * 13; // title + lead line + data lines
      if (b.notesLines.length) h += 10 + b.notesLines.length * NOTES_LINE_H;
      return h;
    };

    // --- Phase 2: paginate (pure math, nothing drawn yet) ---
    const indexLineH = 16;
    const indexHeaderH = 44;
    const perIndexPage = Math.floor((CONTENT_H - indexHeaderH) / indexLineH);
    const indexPages = includeIndex ? Math.ceil(tunes.length / perIndexPage) : 0;

    let page = indexPages + 1;
    let y = MARGIN;
    for (const b of blocks) {
      const h = Math.min(blockHeight(b), CONTENT_H);
      if (y > MARGIN && y + h > MARGIN + CONTENT_H) {
        page++;
        y = MARGIN;
      }
      b.page = page;
      b.y = y;
      y += h + TUNE_GAP;
    }
    const totalPages = page;

    // --- Phase 3: draw ---
    if (includeIndex) {
      const entries = blocks
        .map(b => ({ title: b.tune.title, page: b.page }))
        .sort((a, b) => a.title.localeCompare(b.title));
      for (let p = 0; p < indexPages; p++) {
        if (p > 0) doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text('Index', MARGIN, MARGIN + 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const slice = entries.slice(p * perIndexPage, (p + 1) * perIndexPage);
        slice.forEach((e, i) => {
          const ey = MARGIN + indexHeaderH + i * indexLineH;
          doc.setTextColor(0);
          doc.text(e.title, MARGIN, ey, { maxWidth: CONTENT_W - 40 });
          doc.text(String(e.page), PAGE_W - MARGIN, ey, { align: 'right' });
          const dotsStart = MARGIN + doc.getTextWidth(e.title) + 6;
          const dotsEnd = PAGE_W - MARGIN - doc.getTextWidth(String(e.page)) - 6;
          if (dotsEnd > dotsStart) {
            doc.setTextColor(180);
            doc.text('.'.repeat(Math.floor((dotsEnd - dotsStart) / doc.getTextWidth('.'))), dotsStart, ey);
          }
        });
      }
    }

    let drawn = 0;
    // The doc starts with one page already; with an index that page is page 1
    // of the index, without one it's the first content page.
    let currentPage = includeIndex ? indexPages : 1;
    for (const b of blocks) {
      onProgress?.(`Writing PDF ${++drawn}/${blocks.length}`);
      while (currentPage < b.page) {
        doc.addPage();
        currentPage++;
      }
      let by = b.y;
      if (b.svg) {
        await doc.svg(b.svg, { x: MARGIN, y: by, width: b.svgW, height: b.svgH });
        by += b.svgH;
      } else if (b.img) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(b.tune.title, MARGIN, by + 14);
        by += 22;
        doc.addImage(b.img.dataUrl, 'JPEG', MARGIN, by, b.imgW, b.imgH);
        by += b.imgH;
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(b.tune.title, MARGIN, by + 14);
        by += 22;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(120);
        doc.text(b.leadLine, MARGIN, by + 10, { maxWidth: CONTENT_W });
        by += 14;
        doc.setFont('helvetica', 'normal');
        for (const line of b.textLines) {
          doc.text(line, MARGIN, by + 10, { maxWidth: CONTENT_W });
          by += 13;
        }
      }
      if (b.notesLines.length) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(NOTES_FONT);
        doc.setTextColor(100);
        doc.text(b.notesLines, MARGIN, by + 10 + NOTES_FONT);
      }
    }

    // Footer page numbers on every page so the index is usable on paper.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150);
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.text(String(p), PAGE_W / 2, PAGE_H - FOOTER_H, { align: 'center' });
    }

    return doc.output('blob');
  } finally {
    container.remove();
  }
}

/**
 * Open the browser print dialog for a PDF blob. Uses a hidden iframe;
 * falls back to opening the PDF in a new tab if the browser refuses.
 */
export function printPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;visibility:hidden;';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.open(url, '_blank');
    }
  };
  document.body.appendChild(iframe);
  // Keep the iframe and URL alive — the print dialog reads from them lazily.
}
