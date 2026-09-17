const TAG_KEY = 'known-tags';
const SET_KEY = 'known-sets';
const RECENT_TAG_KEY = 'recent-tags';
const RECENT_SET_KEY = 'recent-sets';
const RECENT_LIMIT = 10;

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function writeList(key, values) {
  try { localStorage.setItem(key, JSON.stringify(values)); }
  catch {}
}

function write(key, values) {
  writeList(key, [...new Set(values)].sort());
}

// Most-recently used first, so the picker's top suggestions are the tags the
// user actually reaches for. Kept separately from the known list, which stays
// alphabetical and is rebuilt wholesale by syncKnownLabels.
function touch(key, value) {
  writeList(key, [value, ...read(key).filter(v => v !== value)].slice(0, RECENT_LIMIT));
}

function byRecency(known, recentKey) {
  const recent = read(recentKey).filter(v => known.includes(v));
  return [...recent, ...known.filter(v => !recent.includes(v))];
}

export function getKnownTags() { return byRecency(read(TAG_KEY), RECENT_TAG_KEY); }
export function getKnownSets() { return byRecency(read(SET_KEY), RECENT_SET_KEY); }

export function addKnownTag(tag) {
  write(TAG_KEY, [...read(TAG_KEY), tag]);
  touch(RECENT_TAG_KEY, tag);
}

export function addKnownSet(set) {
  write(SET_KEY, [...read(SET_KEY), set]);
  touch(RECENT_SET_KEY, set);
}

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
