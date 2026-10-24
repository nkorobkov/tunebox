import { pb } from './pb';

// A tune picked on one of the static collection pages (public/tune-index/app.js)
// by a signed-out visitor who then chose "Sign in". The page stores the record
// it would have created here before starting the Google OAuth redirect; once
// the app is signed in we create it and open it. Keep the key in sync with
// app.js.
const KEY = 'tunebox.pendingTune';
// A stale entry (sign-in abandoned, then a normal sign-in days later) is dropped.
const MAX_AGE_MS = 60 * 60 * 1000;

/** Create the pending tune, if any, for the signed-in user. Resolves to the new record or null. */
export async function claimPendingTune() {
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(KEY));
    // Remove first so a reload (or a failed create) never adds it twice.
    localStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!pending?.tune?.title || !(Date.now() - pending.savedAt < MAX_AGE_MS)) return null;

  const { title, type, abc, session_id, session_url, setting_key } = pending.tune;
  return pb.collection('user_tunes').create({
    title, type, abc, session_id, session_url, setting_key,
    labels: [],
    instruments: {},
    user: pb.authStore.record.id,
  });
}
