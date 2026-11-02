// ABC from a picture or PDF of sheet music, through the recognition service (omr-api.js).
// Used by the "From picture" import and by sheet-music attachments on the tune page.
import { recognizeWhenAllowed, toUploadable } from './omr-api';
import { isPdfFile, renderPdfPage } from './pdf-import';
import { parseAbcMeta } from './abc-utils';

/** Whether a file name is something the service can read: an image or a PDF. */
export function canParseAbc(name) {
  return /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/i.test(name || '');
}

/**
 * Recognize the music in a file (a PDF's first page). Waits its turn when the service
 * says "not yet" (the per-user interval between uploads, a full queue) instead of failing.
 * @returns {Promise<string>} the ABC
 * @throws OmrError (quota_exceeded, no_music_found, …) or AbortError
 */
export async function recognizeFile(file, { signal } = {}) {
  const image = isPdfFile(file) ? (await renderPdfPage(file, 1)).blob : await toUploadable(file);
  const name = (file.name || 'score').replace(/\.[^.]+$/, '') + (image.type === 'image/png' ? '.png' : '.jpg');
  const result = await recognizeWhenAllowed(image, name, { signal });
  if (result.status === 'done') return result.abc;
  const err = new Error(result.error?.code === 'no_music_found'
    ? 'No sheet music found in this file.'
    : result.error?.message || 'Parsing failed.');
  err.code = result.error?.code || 'failed';
  throw err;
}

/**
 * The fields recognized ABC can fill on a tune: only empty ones, never the title. The
 * tune's title goes into the ABC as T: when the scan has none.
 */
export function abcFillPatch(tune, abc) {
  const meta = parseAbcMeta(abc);
  const patch = {};
  if (!tune.abc?.trim()) {
    const titled = /^T:/m.test(abc) || !tune.title ? abc
      : /^X:.*$/m.test(abc) ? abc.replace(/^(X:.*)$/m, `$1\nT:${tune.title}`) : `T:${tune.title}\n${abc}`;
    patch.abc = titled;
  }
  if (!tune.setting_key && meta.key && meta.key !== 'none') patch.setting_key = meta.key;
  if (!tune.type && meta.type) patch.type = meta.type;
  return patch;
}
