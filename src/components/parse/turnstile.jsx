import { useEffect, useRef } from 'preact/hooks';

// Cloudflare Turnstile (bot check for signed-out uploads on /play-sheet-music). The script is
// loaded only when the widget is first shown; the CSP allows challenges.cloudflare.com in
// script-src and frame-src for it.
let scriptPromise = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => { scriptPromise = null; reject(new Error('Turnstile failed to load')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Renders the widget and reports tokens through onToken (null when a token expires or
 * the check errors). Tokens are single use: change resetKey after each upload to get a
 * fresh one.
 */
export function Turnstile({ siteKey, onToken, resetKey, onError }) {
  const ref = useRef(null);
  const widgetId = useRef(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !ref.current) return;
        widgetId.current = turnstile.render(ref.current, {
          sitekey: siteKey,
          action: 'play-sheet-music',
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => { onTokenRef.current(null); },
        });
      })
      .catch((err) => onError?.(err));
    return () => {
      cancelled = true;
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widgetId.current != null) {
      onTokenRef.current(null);
      window.turnstile?.reset(widgetId.current);
    }
  }, [resetKey]);

  return <div ref={ref} class="min-h-[65px]" />;
}
