import PocketBase from 'pocketbase';

const PB_URL = import.meta.env.VITE_PB_URL || 'https://pb.home.nkorobkov.com';

export const pb = new PocketBase(PB_URL);

// Sliding-window auth: token TTL on the server is 30 days. Whenever the user
// performs any action (= an API call), if the token is more than half-spent
// we kick off a background refresh. As long as the user opens the app at
// least once every 30 days, they never get logged out.
//
// The refresh fires asynchronously and we don't await it — the in-flight call
// proceeds with the current (still-valid) token. The new token lands by the
// time the next request goes out.
const HALF_TTL_SECONDS = 15 * 86400;

let refreshInFlight = false;

pb.beforeSend = function (url, options) {
  if (pb.authStore.isValid && pb.authStore.token && !refreshInFlight) {
    try {
      const payload = JSON.parse(atob(pb.authStore.token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      const remaining = payload.exp - now;
      if (remaining < HALF_TTL_SECONDS) {
        refreshInFlight = true;
        pb.collection('users').authRefresh()
          .catch(() => { pb.authStore.clear(); })
          .finally(() => { refreshInFlight = false; });
      }
    } catch {
      // Malformed token — let the next request 401 and the auth flow handle it.
    }
  }
  return { url, options };
};
