import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';

/**
 * Media attached to a whole set rather than to one tune — mainly the backing
 * track the set is practised over. Records live in `set_attachments` and are
 * keyed on user + normalized set key (see src/lib/sets.js), because sets
 * exist only as labels shared between tunes.
 */
export function useSetAttachments(setKey, setName) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!setKey) return;
    // Not cached for offline use — skip the request so a set view doesn't
    // trip the connectivity failure threshold (same as useAttachments).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const userId = pb.authStore.record?.id;
      if (!userId) return;
      const result = await pb.collection('set_attachments').getList(1, 100, {
        filter: `user = "${userId}" && set_key = "${setKey}"`,
        requestKey: `set-attachments-${setKey}`,
      });
      setAttachments(result.items);
    } catch (err) {
      console.error('Failed to fetch set attachments:', err);
    } finally {
      setLoading(false);
    }
  }, [setKey]);

  useEffect(() => {
    if (pb.authStore.isValid) fetch();
  }, [fetch]);

  const upload = useCallback(async ({ file, url, type, bpm, label }) => {
    const base = {
      user: pb.authStore.record.id,
      set_key: setKey,
      set_name: setName || setKey,
    };
    let record;
    if (url) {
      record = await pb.collection('set_attachments').create({
        ...base,
        url,
        type: type || undefined,
        bpm: bpm || undefined,
        label: label || undefined,
      });
    } else {
      const formData = new FormData();
      formData.append('file', file);
      for (const [k, v] of Object.entries(base)) formData.append(k, v);
      if (type) formData.append('type', type);
      if (bpm) formData.append('bpm', bpm);
      if (label) formData.append('label', label);
      record = await pb.collection('set_attachments').create(formData);
    }
    setAttachments(prev => [record, ...prev]);
    return record;
  }, [setKey, setName]);

  const update = useCallback(async (id, data) => {
    const updated = await pb.collection('set_attachments').update(id, data);
    setAttachments(prev => prev.map(a => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await pb.collection('set_attachments').delete(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const backingTracks = attachments.filter(a => a.type === 'backing_track');

  return { attachments, loading, upload, update, remove, backingTracks, refresh: fetch };
}
