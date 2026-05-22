// Gate the service worker reload so it only happens at a "safe" moment:
// on the library page, while online, with an empty practice queue.

import { registerSW } from 'virtual:pwa-register';
import { queueLength, subscribe as subscribeQueue } from './practice-queue';

let pendingUpdate = false;
let updateSW = null;

export function initServiceWorkerUpdates() {
  if (typeof window === 'undefined') return;
  if (updateSW) return; // already initialized
  try {
    updateSW = registerSW({
      onNeedRefresh() {
        pendingUpdate = true;
        tryReload();
      },
      onOfflineReady() {
        // no-op: the connectivity layer already tells the user about offline state
      },
    });
  } catch (err) {
    // virtual:pwa-register only exists when the plugin is active. Silently no-op
    // in environments where it isn't (e.g. dev with devOptions disabled).
    console.debug('SW registration unavailable:', err?.message);
  }

  // Re-check whenever the user navigates or the queue drains.
  window.addEventListener('popstate', tryReload);
  // preact-router uses pushState; patch it to also trigger checks.
  const origPushState = window.history.pushState.bind(window.history);
  window.history.pushState = function (...args) {
    const result = origPushState(...args);
    tryReload();
    return result;
  };

  subscribeQueue(() => tryReload());
}

function tryReload() {
  if (!pendingUpdate || !updateSW) return;
  if (window.location.pathname !== '/') return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (queueLength() > 0) return;
  // Safe to reload — activate the new SW.
  pendingUpdate = false;
  updateSW(true);
}
