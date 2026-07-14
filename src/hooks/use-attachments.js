import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';

export function useAttachments(tuneId) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tuneId) return;
    // Attachments are not cached for offline use — skip the request entirely
    // so each tune view doesn't trip the connectivity failure threshold.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await pb.collection('attachments').getList(1, 100, {
        filter: `user_tune = "${tuneId}"`,
      });
      setAttachments(result.items);
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    } finally {
      setLoading(false);
    }
  }, [tuneId]);

  useEffect(() => {
    if (pb.authStore.isValid) fetch();
  }, [fetch]);

  const upload = useCallback(async ({ file, url, type, bpm, label }) => {
    let record;
    if (url) {
      record = await pb.collection('attachments').create({
        url,
        user: pb.authStore.record.id,
        user_tune: tuneId,
        type: type || undefined,
        bpm: bpm || undefined,
        label: label || undefined,
      });
    } else {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user', pb.authStore.record.id);
      formData.append('user_tune', tuneId);
      if (type) formData.append('type', type);
      if (bpm) formData.append('bpm', bpm);
      if (label) formData.append('label', label);
      record = await pb.collection('attachments').create(formData);
    }
    setAttachments(prev => [record, ...prev]);
    return record;
  }, [tuneId]);

  const update = useCallback(async (id, data) => {
    const updated = await pb.collection('attachments').update(id, data);
    setAttachments(prev => prev.map(a => (a.id === id ? updated : a)));
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await pb.collection('attachments').delete(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const setMainSource = useCallback(async (id, value) => {
    // If enabling, clear any existing main_source first
    if (value) {
      const current = attachments.find(a => a.main_source);
      if (current && current.id !== id) {
        await pb.collection('attachments').update(current.id, { main_source: false });
      }
    }
    const updated = await pb.collection('attachments').update(id, { main_source: value });
    setAttachments(prev => prev.map(a => {
      if (a.id === id) return updated;
      if (value && a.main_source) return { ...a, main_source: false };
      return a;
    }));
  }, [attachments]);

  const mainSource = attachments.find(a => a.main_source && a.type === 'sheet_music');
  const backingTracks = attachments.filter(a => a.type === 'backing_track');
  const sources = attachments.filter(a => a.type === 'source');

  return { attachments, loading, upload, update, remove, setMainSource, mainSource, backingTracks, sources, refresh: fetch };
}

export function getFileUrl(attachment) {
  return pb.files.getURL(attachment, attachment.file);
}

export function isAudio(filename) {
  return /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(filename);
}

export function isImage(filename) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
}
