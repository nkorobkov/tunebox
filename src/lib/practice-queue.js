import { pb } from './pb';

const KEY = 'tunebox_practice_queue';
const MAX_QUEUE_SIZE = 200;

const subscribers = new Set();

function readQueue() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('practice-queue: write failed', err);
  }
  for (const cb of subscribers) {
    try { cb(); } catch (e) { console.error(e); }
  }
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isNetworkErr(err) {
  if (!err) return false;
  if (err.isAbort) return false;
  if (err.status === 0) return true;
  const original = err.originalError;
  if (original && original.name === 'TypeError') return true;
  if (err.name === 'TypeError') return true;
  return false;
}

export function queueLength(userId) {
  const entries = readQueue();
  if (!userId) return entries.length;
  return entries.filter(e => e.userId === userId).length;
}

export function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function enqueuePractice({ tuneId, userId, instrument, tuneUpdate, practiceLog }) {
  const entries = readQueue();
  if (entries.length >= MAX_QUEUE_SIZE) {
    throw new Error('Offline practice queue is full. Reconnect to sync before recording more.');
  }
  entries.push({
    id: uuid(),
    enqueuedAt: new Date().toISOString(),
    tuneId,
    userId,
    instrument,
    tuneUpdate,
    practiceLog,
  });
  writeQueue(entries);
}

let flushing = false;

export async function flushQueue(currentUserId) {
  if (flushing) return { flushed: 0, dropped: 0 };
  if (!currentUserId) return { flushed: 0, dropped: 0 };
  flushing = true;
  let flushed = 0;
  let dropped = 0;
  try {
    while (true) {
      const entries = readQueue();
      // Only process entries belonging to the currently signed-in user; leave
      // others in place so the original user can flush them on next sign-in.
      const next = entries.find(e => e.userId === currentUserId);
      if (!next) break;
      try {
        await pb.collection('user_tunes').update(next.tuneId, next.tuneUpdate);
        await pb.collection('practice_log').create(next.practiceLog);
      } catch (err) {
        if (isNetworkErr(err)) {
          // Likely back offline — leave entry in place and stop.
          break;
        }
        // Permanent failure (404/403/validation). Drop the entry so it can't
        // block the rest of the queue forever.
        console.warn('practice-queue: dropping entry after permanent failure', { id: next.id, err });
        const fresh = readQueue();
        writeQueue(fresh.filter(e => e.id !== next.id));
        dropped += 1;
        continue;
      }
      const fresh = readQueue();
      writeQueue(fresh.filter(e => e.id !== next.id));
      flushed += 1;
    }
  } finally {
    flushing = false;
  }
  return { flushed, dropped };
}

export function clearQueue() {
  writeQueue([]);
}
