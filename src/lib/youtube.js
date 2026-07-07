// YouTube link parsing and embed helpers.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Parse a "1h2m30s" / "90s" / "90" time value into seconds. */
function parseStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

/**
 * Extract `{ id, start }` from any common YouTube URL form
 * (watch, youtu.be, shorts, live, embed, music.), or null.
 */
export function parseYouTube(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = u.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    const path = u.pathname;
    if (path === '/watch') {
      id = u.searchParams.get('v');
    } else {
      const m = path.match(/^\/(?:shorts|live|embed|v)\/([^/?]+)/);
      if (m) id = m[1];
    }
  }
  if (!id || !VIDEO_ID.test(id)) return null;
  return { id, start: parseStart(u.searchParams.get('t') || u.searchParams.get('start')) };
}

export function isYouTubeUrl(url) {
  return parseYouTube(url) !== null;
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

/**
 * Split free text into parts for linkified rendering:
 * `[{ text }, { url }, ...]` preserving order.
 */
export function splitUrls(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    // Trim trailing punctuation that's likely sentence-level, not URL.
    let url = m[0].replace(/[.,;:!?]+$/, '');
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ url });
    last = m.index + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** All distinct YouTube videos referenced in a block of text. */
export function extractYouTubeLinks(text) {
  if (!text) return [];
  const seen = new Set();
  const links = [];
  for (const part of splitUrls(text)) {
    if (!part.url) continue;
    const parsed = parseYouTube(part.url);
    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      links.push({ url: part.url, ...parsed });
    }
  }
  return links;
}

/**
 * Canonical short form for display: `youtu.be/<id>` (+ start time),
 * regardless of the format the link was added in. Falls back to the
 * original string for anything unparseable.
 */
export function shortYouTubeUrl(url) {
  const parsed = parseYouTube(url);
  if (!parsed) return url;
  return `youtu.be/${parsed.id}${parsed.start ? `?t=${parsed.start}` : ''}`;
}

export function youtubeThumbnail(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
