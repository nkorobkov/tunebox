const KEY = 'tunebox_tunes_cache';
const VERSION = 1;

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRaw(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('tune-cache: write failed', err);
  }
}

export function saveTunesToCache(userId, tunes) {
  writeRaw({ version: VERSION, userId, savedAt: new Date().toISOString(), tunes });
}

export function loadTunesFromCache(userId) {
  const data = readRaw();
  if (!data || data.userId !== userId) return null;
  return { tunes: data.tunes, savedAt: data.savedAt };
}

export function getTuneFromCache(userId, tuneId) {
  const cached = loadTunesFromCache(userId);
  if (!cached) return null;
  return cached.tunes.find(t => t.id === tuneId) || null;
}

export function updateTuneInCache(userId, tuneId, patch) {
  const data = readRaw();
  if (!data || data.userId !== userId) return null;
  let next = null;
  data.tunes = data.tunes.map(t => {
    if (t.id !== tuneId) return t;
    next = { ...t, ...patch };
    return next;
  });
  data.savedAt = new Date().toISOString();
  writeRaw(data);
  return next;
}

export function clearTuneCache() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
