import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';
import { getDefaultTempo } from '../lib/abc-utils';
import {
  calculatePriority,
  daysSince,
  getInstrumentData,
  instrumentProficiency,
  updateStability,
  relearnTempo,
  practicedToday,
  isDue,
  INITIAL_STABILITY,
} from '../lib/practice-algorithm';
import { groupSets, setPriority, setReadiness } from '../lib/sets';
import { updateTuneInCache, loadTunesFromCache } from '../lib/tune-cache';
import { enqueuePractice } from '../lib/practice-queue';

const LOCALSTORAGE_KEY = 'tunebox_default_instrument';

export function getDefaultInstrument() {
  try { return localStorage.getItem(LOCALSTORAGE_KEY) || ''; }
  catch { return ''; }
}

export function saveDefaultInstrument(instrument) {
  try { localStorage.setItem(LOCALSTORAGE_KEY, instrument); }
  catch { /* noop */ }
}

// --- Standalone practice actions (no hook state) ---

/**
 * Core helper: update instrument data on a tune and log the practice.
 */
async function savePractice(tune, instrument, { current_tempo, stability, tempo_used, fluency_rating }) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);

  const updatedInstruments = {
    ...tune.instruments,
    [instrument]: {
      ...tune.instruments?.[instrument],
      keys: instData.keys,
      current_tempo: current_tempo ?? instData.current_tempo,
      target_tempo: instData.target_tempo,
      stability: stability ?? instData.stability,
      last_practiced: new Date().toISOString(),
    },
  };

  const userId = pb.authStore.record?.id;
  if (!userId) throw new Error('Not signed in');
  const practicedAt = new Date().toISOString();
  const practiceLog = {
    user: userId,
    user_tune: tune.id,
    instrument,
    practiced_at: practicedAt,
    tempo_used,
    fluency_rating,
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Offline: write through the cache and enqueue the dual write.
    const cachedUpdate = updateTuneInCache(userId, tune.id, { instruments: updatedInstruments });
    const updated = cachedUpdate || { ...tune, instruments: updatedInstruments };
    enqueuePractice({
      tuneId: tune.id,
      userId,
      instrument,
      tuneUpdate: { instruments: updatedInstruments },
      practiceLog,
    });
    return { updated, instData };
  }

  const previousInstruments = tune.instruments;
  const updated = await pb.collection('user_tunes').update(tune.id, { instruments: updatedInstruments });
  try {
    await pb.collection('practice_log').create(practiceLog);
  } catch (err) {
    // Roll back the tune update so data stays consistent
    await pb.collection('user_tunes').update(tune.id, { instruments: previousInstruments });
    throw err;
  }

  // Keep cache in sync so the next offline session sees the latest state.
  updateTuneInCache(userId, tune.id, { instruments: updatedInstruments });

  return { updated, instData };
}

/**
 * Save a learning-mode practice: update tempo, stability, optionally move to playing.
 */
export async function saveLearningPractice(tune, instrument, practicedTempo) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);
  const movedToPlaying = practicedTempo >= instData.target_tempo;

  // Learning tunes are due every day no matter what stability says, so daily
  // work in learning mode must not move it — it would only decide, arbitrarily,
  // where the tune starts its playing ladder. Graduating resets that ladder to
  // its first rung instead.
  const { updated } = await savePractice(tune, instrument, {
    current_tempo: practicedTempo,
    stability: movedToPlaying ? INITIAL_STABILITY : instData.stability,
    tempo_used: practicedTempo,
    fluency_rating: 4,
  });

  return { movedToPlaying, updated };
}

/**
 * Save a playing-mode practice: update stability, optionally move to learning.
 */
export async function savePlayingPractice(tune, instrument, rating, tempoUsed) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);
  const isRelearn = rating === 'relearn';

  const fluencyMap = { easy: 5, good: 4, hard: 2 };

  // Growth is scaled by how much of the scheduled rest was actually used, so
  // the model needs the real gap, not just the rating.
  const elapsed = daysSince(instData.last_practiced);

  const { updated } = await savePractice(tune, instrument, {
    current_tempo: isRelearn ? relearnTempo(instData.target_tempo) : instData.current_tempo,
    stability: isRelearn ? INITIAL_STABILITY : updateStability(instData.stability, rating, elapsed),
    tempo_used: tempoUsed || instData.target_tempo,
    fluency_rating: fluencyMap[rating] || 1,
  });

  return { isRelearn, updated };
}

/**
 * Practise a whole set as one item: the single rating the user gave the set
 * is recorded against every tune in it, so each tune's stability, tempo and
 * practice_log advance exactly as if it had been practised on its own.
 * Sequential on purpose — savePractice rolls a tune back if its log write
 * fails, and a partial set is better than a corrupt one.
 */
export async function saveSetPlayingPractice(tunes, instrument, rating, tempoUsed) {
  const updated = [];
  for (const tune of tunes) {
    const res = await savePlayingPractice(tune, instrument, rating, tempoUsed);
    updated.push(res.updated);
  }
  return { isRelearn: rating === 'relearn', updated };
}

/**
 * Save a learning-mode struggle: log the attempt, leave tempo alone.
 * Stability is deliberately untouched — a tune still being learned comes back
 * tomorrow either way, and letting these presses drive it down is what used to
 * leave tunes graduating into playing mode with a stability far below a day.
 */
export async function saveLearningStruggle(tune, instrument) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);

  const { updated } = await savePractice(tune, instrument, {
    stability: instData.stability,
    tempo_used: instData.current_tempo,
    fluency_rating: 2,
  });

  return { updated };
}

// --- Hooks ---

export function useTunesByInstrument() {
  const [allTunes, setAllTunes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const userId = pb.authStore.record?.id;
      if (!userId) return;
      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
      });
      setAllTunes(result.items);
    } catch (err) {
      const userId = pb.authStore.record?.id;
      const cached = userId ? loadTunesFromCache(userId) : null;
      if (cached) {
        setAllTunes(cached.tunes);
      } else {
        console.error('Failed to fetch tunes:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pb.authStore.isValid) fetch();
  }, [fetch]);

  const forInstrument = (instrument) => {
    const learning = [];
    const playing = [];
    const notStarted = [];
    for (const t of allTunes) {
      const prof = instrumentProficiency(t, instrument);
      if (prof === 'learning') learning.push(t);
      else if (prof === 'playing') playing.push(t);
      else notStarted.push(t);
    }
    return { learning, playing, notStarted };
  };

  return { allTunes, forInstrument, loading, refetch: fetch };
}

/**
 * Today's practice_log entries for the current user + instrument, newest
 * first. Pass a falsy instrument to pause (e.g. while a session is active).
 * Returns null while loading/paused/offline/on error, [] when nothing yet.
 */
export function useTodayPractice(instrument) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    if (!instrument) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const userId = pb.authStore.record?.id;
    if (!userId) return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const since = midnight.toISOString().replace('T', ' ');
    pb.collection('practice_log').getList(1, 200, {
      filter: `user = "${userId}" && instrument = "${instrument}" && practiced_at >= "${since}"`,
      sort: '-practiced_at',
      fields: 'id,user_tune,practiced_at,tempo_used,fluency_rating',
    })
      .then(res => { if (!cancelled) setEntries(res.items); })
      .catch(() => { /* today stats are optional — stay hidden */ });
    return () => { cancelled = true; };
  }, [instrument]);

  return entries;
}

/**
 * Replace one tune wherever it appears in the queue — standalone or inside
 * a set item — after a save returns its updated record.
 */
function replaceTuneInQueue(queue, updated) {
  return queue.map(item => {
    if (item.kind === 'set') {
      if (!item.tunes.some(t => t.id === updated.id)) return item;
      return { ...item, tunes: item.tunes.map(t => (t.id === updated.id ? updated : t)) };
    }
    return item.tune.id === updated.id ? { ...item, tune: updated } : item;
  });
}

/**
 * The practice queue. Items are either a single tune
 * (`{ kind: 'tune', tune }`) or a whole set played end to end
 * (`{ kind: 'set', key, name, tunes }`). A set only collapses into one item
 * when it is ready — every tune learned at one shared target tempo — and
 * when all of its tunes made it through today's filters; otherwise its
 * tunes queue individually.
 */
export function usePracticeSession(instrument, { includePracticedToday = false, tags = [], setKey = '' } = {}) {
  const [allTunes, setAllTunes] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const buildQueue = useCallback((tunes, { includePracticedToday: incl = false, tags: filterTags = [], setKey: onlySet = '' } = {}) => {
    const eligible = tunes.filter(t => {
      const prof = instrumentProficiency(t, instrument);
      return prof === 'learning' || prof === 'playing';
    });

    const asTuneItem = (tune) => ({
      kind: 'tune',
      id: tune.id,
      tune,
      priority: calculatePriority(tune, instrument, tune.canonical_tempo || getDefaultTempo(tune.type)),
    });

    const asSetItem = (set) => ({
      kind: 'set',
      id: `set:${set.key}`,
      key: set.key,
      name: set.name,
      tunes: set.tunes,
      priority: setPriority(set.tunes, instrument),
    });

    const isWholeSet = (set) =>
      set.tunes.length >= 2 && setReadiness(set.tunes, instrument).ready;

    // Deep link into one set (/practice?set=…): just that set, whether or not
    // it is due — asking for it is the schedule.
    if (onlySet) {
      const set = groupSets(tunes).get(onlySet);
      if (!set) return [];
      const eligibleIds = new Set(eligible.map(t => t.id));
      const members = set.tunes.filter(t => eligibleIds.has(t.id));
      if (members.length === set.tunes.length && isWholeSet(set)) return [asSetItem(set)];
      return members.map(asTuneItem);
    }

    let filtered = incl
      ? eligible
      : eligible.filter(t => isDue(t, instrument) && !practicedToday(t, instrument));

    if (filterTags.length > 0) {
      filtered = filtered.filter(t =>
        (t.labels || []).some(l => l.type === 'tag' && filterTags.includes(l.value))
      );
    }

    // Sets are grouped from the full library so membership is complete: a set
    // with a member that didn't survive filtering stays split into tunes.
    const queued = new Set(filtered.map(t => t.id));
    const claimed = new Set();
    const items = [];

    for (const set of groupSets(tunes).values()) {
      if (!isWholeSet(set)) continue;
      if (!set.tunes.every(t => queued.has(t.id))) continue;
      items.push(asSetItem(set));
      for (const t of set.tunes) claimed.add(t.id);
    }

    for (const tune of filtered) {
      if (claimed.has(tune.id)) continue;
      items.push(asTuneItem(tune));
    }

    return items.sort((a, b) => b.priority - a.priority);
  }, [instrument]);

  const fetchAndBuild = useCallback(async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.record?.id;
      if (!userId) return;
      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
      });
      setAllTunes(result.items);
      setQueue(buildQueue(result.items, { includePracticedToday, tags, setKey }));
      setCurrentIndex(0);
      setSkippedIds(new Set());
    } catch (err) {
      const userId = pb.authStore.record?.id;
      const cached = userId ? loadTunesFromCache(userId) : null;
      if (cached) {
        setAllTunes(cached.tunes);
        setQueue(buildQueue(cached.tunes, { includePracticedToday, tags, setKey }));
        setCurrentIndex(0);
        setSkippedIds(new Set());
      } else {
        console.error('Failed to fetch practice queue:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [buildQueue, includePracticedToday, tags, setKey]);

  useEffect(() => {
    if (pb.authStore.isValid && instrument) fetchAndBuild();
  }, [fetchAndBuild, instrument]);

  const currentItem = queue[currentIndex] || null;
  const currentTune = currentItem?.kind === 'tune' ? currentItem.tune : null;
  // Everything still waiting behind the item on screen.
  const upcoming = queue.slice(currentIndex + 1);
  const remaining = upcoming.length;

  const advance = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  /**
   * Pull a queued item forward to practise it now. The item being practised
   * isn't dropped — it slides into second place, so jumping is a reorder
   * rather than a skip.
   */
  const jumpTo = useCallback((id) => {
    setQueue(prev => {
      const from = prev.findIndex(it => it.id === id);
      if (from <= currentIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(currentIndex, 0, item);
      return next;
    });
  }, [currentIndex]);

  const skip = useCallback(() => {
    if (currentItem) {
      setSkippedIds(prev => new Set([...prev, currentItem.id]));
    }
    advance();
  }, [currentItem, advance]);

  const completeLearning = useCallback(async (tune, practicedTempo) => {
    const res = await saveLearningPractice(tune, instrument, practicedTempo);
    setQueue(prev => replaceTuneInQueue(prev, res.updated));
    return res;
  }, [instrument]);

  const completeLearningStruggle = useCallback(async (tune) => {
    const res = await saveLearningStruggle(tune, instrument);
    setQueue(prev => replaceTuneInQueue(prev, res.updated));
    return res;
  }, [instrument]);

  const completePlaying = useCallback(async (tune, rating, tempoUsed) => {
    const res = await savePlayingPractice(tune, instrument, rating, tempoUsed);
    setQueue(prev => replaceTuneInQueue(prev, res.updated));
    return res;
  }, [instrument]);

  const completeSet = useCallback(async (tunes, rating, tempoUsed) => {
    const res = await saveSetPlayingPractice(tunes, instrument, rating, tempoUsed);
    setQueue(prev => res.updated.reduce(replaceTuneInQueue, prev));
    return res;
  }, [instrument]);

  return {
    queue,
    currentItem,
    currentTune,
    currentIndex,
    upcoming,
    remaining,
    loading,
    advance,
    skip,
    jumpTo,
    completeLearning,
    completeLearningStruggle,
    completePlaying,
    completeSet,
    totalCount: queue.length,
  };
}
