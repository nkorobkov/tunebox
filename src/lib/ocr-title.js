// Heuristic extraction of a tune title (and sometimes type) from OCR output
// of a sheet-music image. Tuned on a corpus of real whistle-tune scans and
// photos: titles come out as high-confidence, tall lines near the top of the
// page, while staff notation OCRs into low-confidence symbol soup. Precision
// over recall — an empty result (user types the title) beats garbage.

const CHORD_RE = /^[A-G][#b♭♯]?(m|min|maj|dim|aug|sus|add)?\d*(\/[A-G][#b♭♯]?)?$/;
const MODE_WORDS = ['major', 'minor', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'aeolian', 'ionian'];
const NOISE_RE = [
  /www\.|\.com|\.org|\.net|https?:/i, // URLs / site footers
  /^scheme\s*:/i,
  /^arranged\b|^arrangement\b|^arr[.:]/i,
  /^(traditional|traditionnel|trad\.?)$/i,
  /^chapter\b/i,
  /^page\s*\d+/i,
  /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/, // bare date
  /bpm/i,
];
const DATE_RE = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g;
const OCR_TUNE_TYPES = ['reel', 'jig', 'slip jig', 'hornpipe', 'polka', 'slide', 'waltz', 'mazurka', 'march', 'barndance', 'scottish', 'schottische', 'bourree', 'bourrée', 'gavotte', 'polska', 'strathspey'];
// Short lowercase words that are legitimate at the edge of a title.
const EDGE_KEEP = new Set(['a', 'an', 'o', 'de', 'la', 'le', 'du', 'el', 'un', 'y']);

function letterCount(s) {
  return (s.match(/\p{L}/gu) || []).length;
}

function isWordlike(tok) {
  const letters = letterCount(tok);
  return letters >= 2 && letters / tok.length >= 0.6;
}

function isChordLine(tokens) {
  return tokens.length > 0 && tokens.every(t => CHORD_RE.test(t.replace(/[|,.:]/g, '')));
}

function lineViable(text, confidence) {
  if (confidence < 50) return false;
  // Lyric/continuation lines trail off with "..."
  if (/(\.{3}|…)\s*$/.test(text)) return false;
  // Only tokens containing letters/digits count — bare punctuation is OCR noise.
  let tokens = text.split(/\s+/).filter(t => /[\p{L}\p{N}]/u.test(t));
  // Ignore short junk prefixes ("os", "a8") when judging the line.
  while (tokens.length > 1 && /^[a-z0-9]{1,2}$/.test(tokens[0]) && !EDGE_KEEP.has(tokens[0])) tokens = tokens.slice(1);
  if (tokens.length === 0 || tokens.length > 8) return false;
  // Need at least one solid word.
  if (!tokens.some(t => letterCount(t) >= 3)) return false;
  const wordFrac = tokens.filter(isWordlike).length / tokens.length;
  if (wordFrac < 0.5) return false;
  // Stray single lowercase letters are a staff-notation OCR signature ('a' is a real word).
  if (tokens.some(t => /^[b-z]$/.test(t))) return false;
  // Titles on sheet music start with a capital or a digit.
  const firstAlpha = (tokens.join(' ').match(/\p{L}/u) || [])[0];
  if (firstAlpha && firstAlpha === firstAlpha.toLowerCase() && firstAlpha !== firstAlpha.toUpperCase()) return false;
  if (NOISE_RE.some(re => re.test(text.trim()))) return false;
  if (isChordLine(tokens)) return false;
  // Key signature line like "G mixolydian".
  if (tokens.length <= 3 && tokens.some(t => MODE_WORDS.includes(t.toLowerCase()))) return false;
  return true;
}

function cleanTitle(raw) {
  let t = raw;
  t = t.replace(DATE_RE, ' ');
  t = t.replace(/\b\d{1,2}[.:]\d{2}\b/g, ' '); // times like 20.17
  t = t.replace(/\bon the session\b/gi, ' ');
  // Tempo fragments: "J = 100", "J: 0s", "d=156" (note symbols OCR as J/d).
  t = t.replace(/\b[JdDe]\s*[:=.]\s*[\w?]{1,4}\b/g, ' ');
  // Leading numbering: "49)", "12.", "#3 -", "9 The..."
  t = t.replace(/^\s*[#(]?\d{1,3}\s*[).:\-]?\s+(?=\p{L})/u, '');
  // Parenthesized type — "La Sansonette (reel)" → strip, remember.
  let type;
  t = t.replace(/\(([^)]{1,20})\)/g, (m, inner) => {
    if (OCR_TUNE_TYPES.includes(inner.trim().toLowerCase())) { type = inner.trim().toLowerCase(); return ' '; }
    return m;
  });
  // "Title. Composer. Whatever" → first sentence.
  const sentences = t.split(/\.\s+/);
  if (sentences.length > 1 && letterCount(sentences[0]) >= 4) t = sentences[0];
  // "Bourrée 2T/4T: Bourrée de Montserrat" → segment after the colon.
  const colonParts = t.split(/:\s*/);
  const lastPart = colonParts[colonParts.length - 1];
  if (colonParts.length > 1 && letterCount(lastPart) >= 5) t = lastPart;
  t = t.replace(/\b(traditional|tradition?nel|trad\.?)\s*$/i, ' ');
  // Junk edge tokens like "os", "rr" (short, lowercase, not real words).
  let tokens = t.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && /^[a-z]{1,2}$/.test(tokens[0]) && !EDGE_KEEP.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && /^[a-z]{1,2}$/.test(tokens[tokens.length - 1]) && !EDGE_KEEP.has(tokens[tokens.length - 1])) tokens.pop();
  t = tokens.join(' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s\-–—.,:;|*_"'“”«»]+|[\s\-–—.,:;|*_"'“”«»]+$/g, '');
  // ALL CAPS → Title Case.
  if (t.length > 3 && t === t.toUpperCase() && /[A-ZÀ-Þ]/.test(t)) {
    t = t.toLowerCase().replace(/(^|[\s\-'/])(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
  }
  return { title: t, type };
}

/**
 * @param {Array<{text: string, confidence: number, bbox: {y0: number, y1: number}}>} lines
 * @returns {{title: string, type?: string}} empty title when nothing trustworthy was found
 */
export function extractTitleFromLines(lines) {
  const viable = lines.filter(l => lineViable(l.text, l.confidence));

  let result = { title: '' };
  if (viable.length > 0) {
    const heights = viable.map(l => l.bbox.y1 - l.bbox.y0).sort((a, b) => a - b);
    const median = heights[Math.floor(heights.length / 2)] || 1;
    const pageBottom = Math.max(...lines.map(l => l.bbox.y1), 1);

    let best = null;
    for (const l of viable) {
      // Titles are set bigger than body/credits text…
      const heightFactor = Math.min(2, Math.max(0.7, (l.bbox.y1 - l.bbox.y0) / median));
      // …and live near the top of the page.
      const posFactor = 1 - 0.5 * (l.bbox.y0 / pageBottom);
      const score = l.confidence * heightFactor * posFactor;
      if (!best || score > best.score) best = { line: l, score };
    }
    const { title, type } = cleanTitle(best.line.text);
    if (title.length >= 3) result = { title, type };
  }

  // A standalone type line ("MAZURKA") or a parenthesized type anywhere —
  // e.g. The Session's header "Cooley's (reel) on The Session" — fills the
  // type field.
  if (!result.type) {
    for (const l of lines) {
      if (l.confidence < 70) continue;
      const t = l.text.trim().toLowerCase().replace(/[.,;:]$/, '');
      if (OCR_TUNE_TYPES.includes(t)) { result.type = t; break; }
      const paren = l.text.match(/\(([^)]{1,20})\)/);
      if (paren && OCR_TUNE_TYPES.includes(paren[1].trim().toLowerCase())) {
        result.type = paren[1].trim().toLowerCase();
        break;
      }
    }
  }
  return result;
}
