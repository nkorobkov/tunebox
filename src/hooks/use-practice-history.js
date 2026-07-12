import { useState, useEffect } from 'preact/hooks';
import { pb } from '../lib/pb';

/**
 * Past practice_log entries for one tune + instrument, oldest first.
 * Returns null while loading/offline/on error, [] when there is no history.
 */
export function usePracticeHistory(tuneId, instrument) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    if (!tuneId || !instrument) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    pb.collection('practice_log').getList(1, 50, {
      filter: `user_tune = "${tuneId}" && instrument = "${instrument}"`,
      sort: '-practiced_at',
      fields: 'id,practiced_at,tempo_used,fluency_rating',
    })
      .then(res => { if (!cancelled) setEntries([...res.items].reverse()); })
      .catch(() => { /* chart is optional — stay hidden */ });
    return () => { cancelled = true; };
  }, [tuneId, instrument]);

  return entries;
}
