import { pb } from './pb';

const PB_BASE = pb.baseURL;

// Use PocketBase proxy to avoid CORS issues with thesession.org
export async function searchTunes(query, page = 1) {
  const res = await fetch(
    `${PB_BASE}/api/session/search?q=${encodeURIComponent(query)}&page=${page}`
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getTune(sessionId) {
  const res = await fetch(`${PB_BASE}/api/session/tune/${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch tune');
  return res.json();
}
