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
 * Upload an image and wait for its ABC. The upload answers at once with the pending job;
 * onStart gets its id, which waitForJob can pick up again after a page reload. onProgress
 * gets the job while it's pending ({status: 'queued'|'running', queue_position}).
 * @returns {Promise<object>} the finished job: {status: 'done', abc, chords, warnings}
 *   or {status: 'failed', error: {code, message}}
 */
export async function recognizeImage(blob, filename, { turnstileToken, onStart, onProgress, signal } = {}) {
  const form = new FormData();
  form.append('file', blob, filename);
  const r = await call('/v1/recognize?wait=0', {
    method: 'POST',
    body: form,
    headers: turnstileToken ? { 'CF-Turnstile-Token': turnstileToken } : {},
    signal,
  });
  if (r.status !== 202) return r.body;
  onStart?.(r.body.id);
  onProgress?.(r.body);
  return waitForJob(r.body.id, { onProgress, signal });
}

/**
 * Wait for a job to finish (see recognizeImage). Throws OmrError 'not_found' when the job
 * is gone (results are kept for an hour) or belongs to someone else.
 */
export async function waitForJob(id, { onProgress, signal } = {}) {
  for (;;) {
    const started = Date.now();
    // Long poll: the service answers as soon as the job finishes, or after 25 s
    const r = await call(`/v1/jobs/${encodeURIComponent(id)}?wait=25`, { signal });
    if (r.status !== 202) return r.body;
    onProgress?.(r.body);
    // Pace the polling should a proxy answer early
    if (Date.now() - started < 2000) await sleep((r.retryAfter || 5) * 1000, signal);
  }
}

// Formats the recognition service takes as-is; anything else the browser can decode
// (e.g. HEIC photos in Safari) is converted to JPEG first.
const DIRECT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** An image file the service accepts: as-is, or re-encoded as JPEG. */
export async function toUploadable(file) {
  if (DIRECT_TYPES.includes(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new OmrError('unsupported', 'This file type isn’t supported. Use a PNG, JPEG or PDF.');
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

/** The caller's quota: {kind: 'user'|'anonymous', per_day, used_today, remaining_today, retry_after}. */
export async function getQuota() {
  return (await call('/v1/quota')).body;
}
