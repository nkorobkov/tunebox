import { pb } from './pb';

export function avatarUrl(user) {
  if (!user) return null;
  // PocketBase file field — user.avatar is a filename when stored as a file.
  if (user.avatar && typeof user.avatar === 'string') {
    if (user.avatar.startsWith('http')) return user.avatar;
    try {
      return pb.files.getURL(user, user.avatar, { thumb: '128x128' });
    } catch {
      return null;
    }
  }
  return null;
}

export function initials(user) {
  const source = user?.name || user?.email || '?';
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}
