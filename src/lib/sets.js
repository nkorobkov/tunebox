/**
 * Sets are not a table. A tune joins a set through a `set` label on
 * `user_tunes.labels` — `{ type: 'set', value: 'Opening Set', order: 1 }` —
 * and every tune whose set name normalizes to the same key is in the same
 * set. That normalized key is the set's identity everywhere: the /set route,
 * `set_attachments.set_key`, and practice-queue entries.
 */

import {
  calculatePriority,
  instrumentProficiency,
  isDue,
  practicedToday,
} from './practice-algorithm';
import { getDefaultTempo } from './abc-utils';

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeSetName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSetLabel(tune) {
  return (tune?.labels || []).find(l => l.type === 'set' && l.value) || null;
}

export function setKeyOf(tune) {
  const label = getSetLabel(tune);
  return label ? normalizeSetName(label.value) : null;
}

export function setHref(name) {
  return `/set/${encodeURIComponent(normalizeSetName(name))}`;
}

/**
 * Group tunes by set. Returns Map<key, { key, name, tunes }> with each set's
 * tunes in label order. Tunes without a set label are left out.
 */
export function groupSets(tunes) {
  const staged = new Map();
  for (const tune of tunes || []) {
    const label = getSetLabel(tune);
    if (!label) continue;
    const key = normalizeSetName(label.value);
    if (!key) continue;
    if (!staged.has(key)) staged.set(key, { key, name: label.value, entries: [] });
    staged.get(key).entries.push({ tune, order: label.order || 0 });
  }

  const sets = new Map();
  for (const [key, group] of staged) {
    group.entries.sort((a, b) => a.order - b.order);
    sets.set(key, { key, name: group.name, tunes: group.entries.map(e => e.tune) });
  }
  return sets;
}

/** One set by key (a raw route param is fine — it gets normalized). */
export function findSet(tunes, key) {
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch { /* already decoded */ }
  return groupSets(tunes).get(normalizeSetName(decoded)) || null;
}

/**
 * Can this set be played straight through as one unit on `instrument`?
 * That needs every tune learned ('playing' proficiency) and all of them
 * sharing one target tempo — otherwise the tunes are practised separately
 * and we show a warning explaining what's in the way.
 */
export function setReadiness(tunes, instrument) {
  const list = tunes || [];
  const notReady = [];
  const tempos = new Set();

  for (const tune of list) {
    if (instrumentProficiency(tune, instrument) !== 'playing') notReady.push(tune);
    const target = tune.instruments?.[instrument]?.target_tempo || 0;
    if (target > 0) tempos.add(target);
  }

  const tempoList = [...tempos].sort((a, b) => a - b);
  const enoughTunes = list.length >= 2;
  const ready = !!instrument && enoughTunes && notReady.length === 0 && tempoList.length === 1;

  let reason = '';
  if (!instrument) {
    reason = 'No practice instrument selected.';
  } else if (!enoughTunes) {
    reason = 'A set needs at least two tunes to be practised as one.';
  } else if (notReady.length > 0) {
    reason = `${notReady.length} of ${list.length} tunes ${notReady.length === 1 ? 'is' : 'are'} not up to speed on ${instrument} yet.`;
  } else if (tempoList.length > 1) {
    reason = `Target tempos differ (${tempoList.join(', ')} BPM) — pick one for the whole set.`;
  }

  return {
    ready,
    reason,
    notReady,
    tempos: tempoList,
    tempo: tempoList.length === 1 ? tempoList[0] : 0,
  };
}

/** A set is due when any of its tunes is due. */
export function setIsDue(tunes, instrument) {
  return (tunes || []).some(t => isDue(t, instrument));
}

/** A set counts as done for today only once every tune has been practised. */
export function setPracticedToday(tunes, instrument) {
  const list = tunes || [];
  return list.length > 0 && list.every(t => practicedToday(t, instrument));
}

/** The set queues at its most urgent tune's priority. */
export function setPriority(tunes, instrument) {
  return (tunes || []).reduce((max, tune) => Math.max(
    max,
    calculatePriority(tune, instrument, tune.canonical_tempo || getDefaultTempo(tune.type)),
  ), 0);
}
