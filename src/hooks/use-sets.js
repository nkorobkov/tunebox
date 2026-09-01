import { useState, useEffect } from 'preact/hooks';
import { pb } from '../lib/pb';
import { loadTunesFromCache } from '../lib/tune-cache';
import { groupSets } from '../lib/sets';

/**
 * The tunes making up one set, in set order. Seeds from the offline tune
 * cache so a set reference renders immediately, then refreshes from
 * PocketBase. Returns null until anything is known — a set membership check
 * shouldn't flash a warning before the siblings have loaded.
 */
export function useSetTunes(setKey) {
  const [tunes, setTunes] = useState(null);

  useEffect(() => {
    setTunes(null);
    if (!setKey) return;
    const userId = pb.authStore.record?.id;
    if (!userId) return;

    const pick = (records) => groupSets(records).get(setKey)?.tunes || [];

    const cached = loadTunesFromCache(userId);
    if (cached) setTunes(pick(cached.tunes));

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    let cancelled = false;
    pb.collection('user_tunes').getList(1, 500, {
      filter: `user = "${userId}"`,
      fields: 'id,title,type,labels,instruments,canonical_tempo',
      requestKey: `set-tunes-${setKey}`,
    })
      .then(res => { if (!cancelled) setTunes(pick(res.items)); })
      .catch(() => { /* the cached answer (or nothing) stands */ });

    return () => { cancelled = true; };
  }, [setKey]);

  return tunes;
}
