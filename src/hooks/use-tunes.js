import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';

export function useTunes(filters = {}) {
  const [tunes, setTunes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTunes = useCallback(async () => {
    setLoading(true);
    try {
      const userId = pb.authStore.record.id;

      const result = await pb.collection('user_tunes').getList(1, 500, {
        filter: `user = "${userId}"`,
        sort: '-created',
      });
      const records = result.items;

      // Client-side label filtering if needed
      let filtered = records;
      if (filters.labelType && filters.labelValue) {
        filtered = records.filter(t =>
          t.labels?.some(l => l.type === filters.labelType && l.value === filters.labelValue)
        );
      }

      setTunes(filtered);
    } catch (err) {
      console.error('Failed to fetch tunes:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.labelType, filters.labelValue]);

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

  return { tunes, loading, fetchTunes, createTune, updateTune, deleteTune };
}

export function useTune(id) {
  const [tune, setTune] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    pb.collection('user_tunes').getOne(id)
      .then(setTune)
      .catch(err => console.error('Failed to fetch tune:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const updateTune = useCallback(async (data) => {
    const record = await pb.collection('user_tunes').update(id, data);
    setTune(record);
    return record;
  }, [id]);

  return { tune, loading, updateTune };
}
