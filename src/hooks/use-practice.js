import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';
import { isDue, isNew } from '../lib/spaced-repetition';

export function usePractice() {
  const [allTunes, setAllTunes] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.record.id;
      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
      });
      const tunes = result.items;
      setAllTunes(tunes);

      // Due tunes first, then new tunes (no next_review set)
      const due = tunes.filter(isDue);
      const newTunes = tunes.filter(isNew);
      setQueue([...due, ...newTunes]);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to fetch practice queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pb.authStore.isValid) fetchQueue();
  }, [fetchQueue]);

  const currentTune = queue[currentIndex] || null;
  const remaining = Math.max(0, queue.length - currentIndex);

  const advance = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, []);

  const updateCurrentTune = useCallback((updatedTune) => {
    setQueue(prev => prev.map(t => t.id === updatedTune.id ? updatedTune : t));
  }, []);

  return {
    queue,
    currentTune,
    currentIndex,
    remaining,
    loading,
    advance,
    updateCurrentTune,
    totalDue: queue.length,
    fetchQueue,
  };
}
