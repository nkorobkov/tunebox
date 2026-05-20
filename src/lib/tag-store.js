const TAG_KEY = 'known-tags';
const SET_KEY = 'known-sets';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function write(key, values) {
  try { localStorage.setItem(key, JSON.stringify([...new Set(values)].sort())); }
  catch {}
}

export function getKnownTags() { return read(TAG_KEY); }
export function getKnownSets() { return read(SET_KEY); }

export function addKnownTag(tag) { write(TAG_KEY, [...read(TAG_KEY), tag]); }
export function addKnownSet(set) { write(SET_KEY, [...read(SET_KEY), set]); }

export function syncKnownLabels(tunes) {
  const tags = new Set();
  const sets = new Set();
  for (const t of tunes) {
    for (const l of t.labels || []) {
      if (l.type === 'tag' && l.value) tags.add(l.value);
      if (l.type === 'set' && l.value) sets.add(l.value);
    }
  }
  write(TAG_KEY, tags);
  write(SET_KEY, sets);
}
