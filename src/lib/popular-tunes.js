import rows from '../data/popular-tunes.json';

// thesession.org's most popular tunes, most popular first (snapshot written by
// scripts/fetch-popular-tunes.mjs). Shaped like search results.
export const POPULAR_TUNES = rows.map(([id, name, type]) => ({
  id, name, type, url: `https://thesession.org/tunes/${id}`,
}));

const norm = (s) => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/['’`]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const INDEX = POPULAR_TUNES.map(t => ' ' + norm(t.name));

// Popular tunes whose name contains every query word as a word prefix
// ("drow mag" → Drowsy Maggie), in popularity order.
export function filterPopularTunes(query) {
  const words = norm(query).split(' ').filter(w => w && w !== 'the');
  if (!words.length) return POPULAR_TUNES;
  return POPULAR_TUNES.filter((_, i) => words.every(w => INDEX[i].includes(' ' + w)));
}
