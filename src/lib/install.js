// PWA install helpers: detect whether the app is already running from the
// home screen and which mobile platform the visitor is on. Only imported from
// signed-in surfaces (never prerendered), but guard window access anyway.

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function getMobilePlatform() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ reports as a desktop Mac, but real Macs have no touch screen
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return null;
}

export function canPromptInstall() {
  return getMobilePlatform() !== null && !isStandalone();
}

// Chrome on Android fires beforeinstallprompt when the app is installable;
// stashing the event lets the install page trigger the native prompt directly.
let deferredPrompt = null;
const promptListeners = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    promptListeners.forEach((fn) => fn());
  });
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function subscribeInstallPrompt(fn) {
  promptListeners.add(fn);
  return () => promptListeners.delete(fn);
}
