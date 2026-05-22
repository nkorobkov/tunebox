import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';
import { syncKnownLabels } from '../lib/tag-store';
import {
  saveTunesToCache,
  loadTunesFromCache,
  getTuneFromCache,
} from '../lib/tune-cache';

function isNetworkErr(err) {
  if (!err) return false;
  if (err.status === 0) return true;
  if (err.isAbort) return true;
  const original = err.originalError;
  if (original && original.name === 'TypeError') return true;
  if (err.name === 'TypeError') return true;
  return false;
}

export function useTunes(filters = {}) {
  const [tunes, setTunes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState(null);

  const applyFilters = useCallback((records) => {
    if (filters.labelType && filters.labelValue) {
      return records.filter(t =>
        t.labels?.some(l => l.type === filters.labelType && l.value === filters.labelValue)
      );
    }
    return records;
  }, [filters.labelType, filters.labelValue]);

  const fetchTunes = useCallback(async () => {
    setLoading(true);
    const userId = pb.authStore.record?.id;
    if (!userId) { setLoading(false); return; }
    try {
      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
        sort: '-created',
      });
      const records = result.items;
      syncKnownLabels(records);
      saveTunesToCache(userId, records);
      setTunes(applyFilters(records));
      setFromCache(false);
      setCacheSavedAt(null);
    } catch (err) {
      if (isNetworkErr(err)) {
        const cached = userId ? loadTunesFromCache(userId) : null;
        if (cached) {
          syncKnownLabels(cached.tunes);
          setTunes(applyFilters(cached.tunes));
          setFromCache(true);
          setCacheSavedAt(cached.savedAt);
        } else {
          console.warn('Offline and no cached tunes available');
        }
      } else {
        console.error('Failed to fetch tunes:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [applyFilters]);

  useEffect(() => {
    if (pb.authStore.isValid) fetchTunes();
  }, [fetchTunes]);

  const createTune = useCallback(async (data) => {
    const record = await pb.collection('user_tunes').create({
      ...data,
      user: pb.authStore.record.id,
    });
    setTunes(prev => [record, ...prev]);
    return record;
  }, []);

  const updateTune = useCallback(async (id, data) => {
    const record = await pb.collection('user_tunes').update(id, data);
    setTunes(prev => prev.map(t => t.id === id ? record : t));
    return record;
  }, []);

  const deleteTune = useCallback(async (id) => {
    await pb.collection('user_tunes').delete(id);
    setTunes(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tunes, loading, fetchTunes, createTune, updateTune, deleteTune, fromCache, cacheSavedAt };
}

export function useTune(id) {
  const [tune, setTune] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    pb.collection('user_tunes').getOne(id)
      .then(record => {
        setTune(record);
        setFromCache(false);
      })
      .catch(err => {
        if (isNetworkErr(err)) {
          const userId = pb.authStore.record?.id;
          const cached = userId ? getTuneFromCache(userId, id) : null;
          if (cached) {
            setTune(cached);
            setFromCache(true);
          } else {
            console.warn('Offline and tune not in cache:', id);
          }
        } else {
          console.error('Failed to fetch tune:', err);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateTune = useCallback(async (data) => {
    const record = await pb.collection('user_tunes').update(id, data);
    setTune(record);
    return record;
  }, [id]);

  return { tune, loading, updateTune, fromCache };
}
