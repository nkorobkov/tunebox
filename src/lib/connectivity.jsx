import { createContext } from 'preact';
import { useState, useEffect, useContext, useCallback, useRef } from 'preact/hooks';

const ConnectivityContext = createContext(null);

const HEALTH_POLL_MS = 15000;
const FAILURE_FLIP_WINDOW_MS = 10000;
const PB_URL = import.meta.env.VITE_PB_URL || 'https://pb.home.nkorobkov.com';

// Module-level signal sinks so pb.js can feed events without a hook.
const listeners = new Set();
let recentFailures = [];

function notify(status) {
  for (const l of listeners) l(status);
}

export function recordPbSuccess() {
  recentFailures = [];
  notify('online');
}

export function recordPbFailure(err) {
  if (!isNetworkError(err)) return;
  const now = Date.now();
  recentFailures = recentFailures.filter(t => now - t < FAILURE_FLIP_WINDOW_MS);
  recentFailures.push(now);
  if (recentFailures.length >= 2) notify('offline');
}

function isNetworkError(err) {
  if (!err) return false;
  // SDK auto-cancels (isAbort) are caller-initiated, not network failures —
  // treating them as failures flips offline on rapid route changes.
  if (err.isAbort) return false;
  if (err.status === 0) return true;
  // PocketBase wraps fetch errors with originalError pointing at the TypeError.
  const original = err.originalError;
  if (original && original.name === 'TypeError') return true;
  if (err.name === 'TypeError') return true;
  return false;
}

async function probePb() {
  try {
    const res = await fetch(`${PB_URL}/api/health`, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export function ConnectivityProvider({ children }) {
  const [status, setStatus] = useState(
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'
  );
  const pollRef = useRef(null);
  const onlineCallbacksRef = useRef(new Set());

  useEffect(() => {
    const handler = (next) => {
      setStatus(prev => {
        if (prev === next) return prev;
        if (next === 'online') {
          // Fire any registered "back online" callbacks.
          for (const cb of onlineCallbacksRef.current) {
            try { cb(); } catch (e) { console.error('online callback failed', e); }
          }
        }
        return next;
      });
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  useEffect(() => {
    const onOnline = async () => {
      // Browser thinks we're back, but verify PB is reachable before flipping.
      if (await probePb()) notify('online');
    };
    const onOffline = () => notify('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (status !== 'offline') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      if (await probePb()) notify('online');
    }, HEALTH_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
  }, [status]);

  const subscribeOnline = useCallback((cb) => {
    onlineCallbacksRef.current.add(cb);
    return () => onlineCallbacksRef.current.delete(cb);
  }, []);

  const value = {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    subscribeOnline,
  };

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error('useConnectivity must be used within ConnectivityProvider');
  return ctx;
}
