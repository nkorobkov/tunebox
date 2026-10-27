// Client for the sheet-music recognition service (omr-service in the img2abc project,
// hosted on the Pi behind a Cloudflare Tunnel at omr.tunebox.net).
//
// Signed-in users are identified by their PocketBase token, which the service checks with
// PocketBase; they get a daily quota. Signed-out visitors need a Cloudflare Turnstile token
// on every upload (single use, so the widget is reset after each one) and have a smaller
// per-address quota. A conversion can take a minute or more, so the upload returns 202 and
// we poll the job until it finishes.
import { pb } from './pb';

const OMR_URL = (import.meta.env.VITE_OMR_URL || 'https://omr.tunebox.net').replace(/\/$/, '');
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export class OmrError extends Error {
  constructor(code, message, retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function authHeaders() {
  return pb.authStore.isValid && pb.authStore.token
    ? { Authorization: `Bearer ${pb.authStore.token}` }
    : {};
}

async function call(path, { headers = {}, ...options } = {}) {
  let res;
  try {
    res = await fetch(OMR_URL + path, {
      ...options,
      headers: { ...authHeaders(), ...headers },
      credentials: 'omit',
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new OmrError('network', 'Couldn’t reach the conversion service. Check your connection and try again.');
  }
  const body = await res.json().catch(() => ({}));
  const retryAfter = Number(res.headers.get('Retry-After')) || 0;
  if (!res.ok) {
    const e = body.error || {};
    throw new OmrError(e.code || `http_${res.status}`, e.message || 'The conversion service had a problem. Try again.', retryAfter);
  }
  return { status: res.status, body, retryAfter, location: res.headers.get('Location') };
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

/**
 * Upload an image and wait for its ABC. onProgress gets the job while it's pending
 * ({status: 'queued'|'running', queue_position}).
 * @returns {Promise<object>} the finished job: {status: 'done', abc, chords, warnings}
 *   or {status: 'failed', error: {code, message}}
 */
export async function recognizeImage(blob, filename, { turnstileToken, onProgress, signal } = {}) {
  const form = new FormData();
  form.append('file', blob, filename);
  let r = await call('/v1/recognize?wait=25', {
    method: 'POST',
    body: form,
    headers: turnstileToken ? { 'CF-Turnstile-Token': turnstileToken } : {},
    signal,
  });
  const location = r.location;
  while (r.status === 202) {
    onProgress?.(r.body);
    await sleep((r.retryAfter || 5) * 1000, signal);
    r = await call(location, { signal });
  }
  return r.body;
}

/** The caller's quota: {kind: 'user'|'anonymous', per_day, used_today, remaining_today, retry_after}. */
export async function getQuota() {
  return (await call('/v1/quota')).body;
}
