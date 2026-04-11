import { useState, useEffect, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';

export function useAttachments(tuneId) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tuneId) return;
    setLoading(true);
    try {
      const result = await pb.collection('attachments').getList(1, 100, {
        filter: `user_tune = "${tuneId}"`,
        sort: '-created',
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

  const upload = useCallback(async ({ file, type, bpm, label }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', pb.authStore.record.id);
    formData.append('user_tune', tuneId);
    if (type) formData.append('type', type);
    if (bpm) formData.append('bpm', bpm);
    if (label) formData.append('label', label);

    const record = await pb.collection('attachments').create(formData);
    setAttachments(prev => [record, ...prev]);
    return record;
  }, [tuneId]);

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

  return { attachments, loading, upload, remove, setMainSource, mainSource, refresh: fetch };
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
