// Service worker registration and update checks.
//
// registerType is 'autoUpdate' (vite.config.js): a new build takes over as
// soon as it installs, and vite-plugin-pwa's own client reloads the page. The
// only thing added here is a check when the app returns to the foreground — a
// home-screen PWA on iOS is resumed rather than relaunched, so the browser can
// go a long time without checking for a new worker on its own.

import { registerSW } from 'virtual:pwa-register';

const RESUME_CHECK_MS = 30 * 60 * 1000;

let initialized = false;
let registration = null;
let lastCheck = 0;

export function initServiceWorkerUpdates() {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  try {
    registerSW({
      // Register straight away rather than waiting for a load event that may
      // already have fired by the time the app mounts.
      immediate: true,
      onRegisteredSW(_url, reg) {
        registration = reg || null;
      },
      onRegisterError(err) {
        console.debug('SW registration failed:', err?.message);
      },
    });
  } catch (err) {
    // virtual:pwa-register only exists when the plugin is active. Silently no-op
    // in environments where it isn't (e.g. dev with devOptions disabled).
    console.debug('SW registration unavailable:', err?.message);
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('pageshow', checkForUpdate);
}

function checkForUpdate() {
  if (!registration) return;
  if (navigator.onLine === false) return;
  const now = Date.now();
  if (now - lastCheck < RESUME_CHECK_MS) return;
  lastCheck = now;
  registration.update().catch(err => console.debug('SW update check failed:', err?.message));
}
