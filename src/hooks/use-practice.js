import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';
import { getDefaultTempo } from '../lib/abc-utils';
import {
  calculatePriority,
  getInstrumentData,
  instrumentProficiency,
  updateStability,
  relearnTempo,
  practicedToday,
  INITIAL_STABILITY,
} from '../lib/practice-algorithm';

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
 * Save a learning-mode practice: update tempo, stability, optionally move to playing.
 */
export async function saveLearningPractice(tune, instrument, practicedTempo) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);
  const movedToPlaying = practicedTempo >= instData.target_tempo;

  const updatedInstruments = {
    ...tune.instruments,
    [instrument]: {
      ...tune.instruments?.[instrument],
      keys: instData.keys,
      current_tempo: practicedTempo,
      target_tempo: instData.target_tempo,
      stability: updateStability(instData.stability, 'good'),
      last_practiced: new Date().toISOString(),
    },
  };

  const updated = await pb.collection('user_tunes').update(tune.id, { instruments: updatedInstruments });
  await pb.collection('practice_log').create({
    user: pb.authStore.record.id,
    user_tune: tune.id,
    instrument,
    practiced_at: new Date().toISOString(),
    tempo_used: practicedTempo,
    fluency_rating: 4,
  });

  return { movedToPlaying, updated };
}

/**
 * Save a playing-mode practice: update stability, optionally move to learning.
 */
export async function savePlayingPractice(tune, instrument, rating) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);
  const isRelearn = rating === 'relearn';

  const updatedInstruments = {
    ...tune.instruments,
    [instrument]: {
      ...tune.instruments?.[instrument],
      keys: instData.keys,
      current_tempo: isRelearn ? relearnTempo(instData.target_tempo) : instData.current_tempo,
      target_tempo: instData.target_tempo,
      stability: isRelearn ? INITIAL_STABILITY : updateStability(instData.stability, rating),
      last_practiced: new Date().toISOString(),
    },
  };

  const updated = await pb.collection('user_tunes').update(tune.id, { instruments: updatedInstruments });
  await pb.collection('practice_log').create({
    user: pb.authStore.record.id,
    user_tune: tune.id,
    instrument,
    practiced_at: new Date().toISOString(),
    tempo_used: instData.target_tempo,
    fluency_rating: rating === 'easy' ? 5 : rating === 'good' ? 4 : rating === 'hard' ? 2 : 1,
  });

  return { isRelearn, updated };
}

/**
 * Save a learning-mode struggle: lower stability, don't update tempo.
 */
export async function saveLearningStruggle(tune, instrument) {
  const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallback);

  const updatedInstruments = {
    ...tune.instruments,
    [instrument]: {
      ...tune.instruments?.[instrument],
      keys: instData.keys,
      current_tempo: instData.current_tempo,
      target_tempo: instData.target_tempo,
      stability: updateStability(instData.stability, 'hard'),
      last_practiced: new Date().toISOString(),
    },
  };

  const updated = await pb.collection('user_tunes').update(tune.id, { instruments: updatedInstruments });
  await pb.collection('practice_log').create({
    user: pb.authStore.record.id,
    user_tune: tune.id,
    instrument,
    practiced_at: new Date().toISOString(),
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
      const userId = pb.authStore.record.id;
      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
      });
      setAllTunes(result.items);
    } catch (err) {
      console.error('Failed to fetch tunes:', err);
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

export function usePracticeSession(instrument, { includePracticedToday = false } = {}) {
  const [allTunes, setAllTunes] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const buildQueue = useCallback((tunes, { includePracticedToday: incl = false } = {}) => {
    const eligible = tunes.filter(t => {
      const prof = instrumentProficiency(t, instrument);
      return prof === 'learning' || prof === 'playing';
    });

    const filtered = incl
      ? eligible
      : eligible.filter(t => !practicedToday(t, instrument));

    return filtered
      .map(t => ({
        tune: t,
        priority: calculatePriority(t, instrument, t.canonical_tempo || getDefaultTempo(t.type)),
      }))
      .sort((a, b) => b.priority - a.priority)
      .map(x => x.tune);
  }, [instrument]);

  const fetchAndBuild = useCallback(async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.record.id;
      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
      });
      setAllTunes(result.items);
      setQueue(buildQueue(result.items, { includePracticedToday }));
      setCurrentIndex(0);
      setSkippedIds(new Set());
    } catch (err) {
      console.error('Failed to fetch practice queue:', err);
    } finally {
      setLoading(false);
    }
  }, [buildQueue, includePracticedToday]);

  useEffect(() => {
    if (pb.authStore.isValid && instrument) fetchAndBuild();
  }, [fetchAndBuild, instrument]);

  const currentTune = queue[currentIndex] || null;
  const remaining = Math.max(0, queue.length - currentIndex);

  const advance = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const skip = useCallback(() => {
    if (currentTune) {
      setSkippedIds(prev => new Set([...prev, currentTune.id]));
    }
    advance();
  }, [currentTune, advance]);

  const completeLearning = useCallback(async (tune, practicedTempo) => {
    const res = await saveLearningPractice(tune, instrument, practicedTempo);
    setQueue(prev => prev.map(t => t.id === res.updated.id ? res.updated : t));
    return res;
  }, [instrument]);

  const completeLearningStruggle = useCallback(async (tune) => {
    const res = await saveLearningStruggle(tune, instrument);
    setQueue(prev => prev.map(t => t.id === res.updated.id ? res.updated : t));
    return res;
  }, [instrument]);

  const completePlaying = useCallback(async (tune, rating) => {
    const res = await savePlayingPractice(tune, instrument, rating);
    setQueue(prev => prev.map(t => t.id === res.updated.id ? res.updated : t));
    return res;
  }, [instrument]);

  return {
    queue,
    currentTune,
    currentIndex,
    remaining,
    loading,
    advance,
    skip,
    completeLearning,
    completeLearningStruggle,
    completePlaying,
    totalCount: queue.length,
  };
}
