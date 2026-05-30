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

export async function getTunebook(memberId, page = 1) {
  const res = await fetch(`${PB_BASE}/api/session/tunebook/${memberId}?page=${page}`);
  if (!res.ok) throw new Error('Failed to fetch tunebook');
  return res.json();
}

export async function getAllTunebookTunes(memberId, onProgress) {
  const first = await getTunebook(memberId, 1);
  const tunes = [...(first.tunes || [])];
  const totalPages = first.pages || 1;
  if (onProgress) onProgress({ page: 1, totalPages, tunes: tunes.length, total: first.total });
  for (let p = 2; p <= totalPages; p++) {
    const data = await getTunebook(memberId, p);
    tunes.push(...(data.tunes || []));
    if (onProgress) onProgress({ page: p, totalPages, tunes: tunes.length, total: first.total });
  }
  return { member: first.member, total: first.total, tunes };
}

export function parseSessionMemberRef(input) {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/thesession\.org\/members\/(\d+)/i);
  return m ? m[1] : null;
}
