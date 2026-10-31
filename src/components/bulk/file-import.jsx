import { useState, useEffect, useRef } from 'preact/hooks';
import { pb } from '../../lib/pb';
import { recognizeLines, releaseOcrWorker } from '../../lib/ocr';
import { analyzePdf, isPdfFile, renderPdfPage } from '../../lib/pdf-import';
import { extractTitleFromLines } from '../../lib/ocr-title';
import { recognizeImage, toUploadable } from '../../lib/omr-api';
import { parseAbcMeta } from '../../lib/abc-utils';
import { TUNE_TYPES } from '../tune/tune-form';
import { AbcViewer } from '../tune/abc-viewer';
import { Button } from '../common/button';
import { useConnectivity } from '../../lib/connectivity';

let nextId = 0;

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

function ocrStatusText(item) {
  switch (item.ocrStatus) {
    case 'queued': return { text: 'Waiting to read title…', tone: 'text-gray-400' };
    case 'reading': return { text: 'Reading title from file…', tone: 'text-gray-400 animate-pulse' };
    case 'empty': return { text: "Couldn't read a title — type it in.", tone: 'text-amber-600' };
    case 'failed': return { text: 'Text recognition failed — type the title.', tone: 'text-amber-600' };
    default: return null;
  }
}

const PARSE_LABELS = { queued: 'Queued', parsing: 'Parsing…' };
const isParsePending = (item) => item.abcStatus === 'queued' || item.abcStatus === 'parsing';

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

// Send one file to the recognition service. The service allows one upload a minute per
// user, so a queue of files waits its turn instead of failing.
async function recognizeFile(item, signal) {
  const image = item.isPdf ? (await renderPdfPage(item.file, 1)).blob : await toUploadable(item.file);
  const name = item.file.name.replace(/\.[^.]+$/, '') + (image.type === 'image/png' ? '.png' : '.jpg');
  for (;;) {
    try {
      return await recognizeImage(image, name, { signal });
    } catch (err) {
      if (err.code !== 'rate_limited') throw err;
      await sleep((err.retryAfter || 10) * 1000, signal);
    }
  }
}

function FileRow({ item, onChange, onRemove, onParse, disabled, parseDisabled }) {
  const status = ocrStatusText(item);
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-start gap-4">
        <a href={item.previewUrl} target="_blank" rel="noopener" class="shrink-0" title="Open full size">
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt={item.file.name} class="w-20 h-24 object-cover rounded border border-gray-200 bg-gray-50" />
          ) : (
            <div class="w-20 h-24 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-400">
              PDF
            </div>
          )}
        </a>
        <div class="flex-1 min-w-0 space-y-2">
          <div>
            <input
              type="text"
              value={item.title}
              onInput={e => onChange({ title: e.target.value })}
              placeholder="Title *"
              disabled={disabled}
              class={inputClass}
            />
            {status && <p class={`text-xs mt-1 ${status.tone}`}>{status.text}</p>}
            {item.error && <p class="text-xs mt-1 text-red-500">{item.error}</p>}
          </div>
          <div class="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={item.type}
              onInput={e => onChange({ type: e.target.value })}
              list="tune-types-import"
              placeholder="Type"
              disabled={disabled}
              class={inputClass}
            />
            <input
              type="text"
              value={item.key}
              onInput={e => onChange({ key: e.target.value })}
              placeholder="Key"
              disabled={disabled}
              class={inputClass}
            />
            <input
              type="number"
              value={item.tempo}
              onInput={e => onChange({ tempo: e.target.value })}
              placeholder="Tempo"
              min="1"
              max="400"
              disabled={disabled}
              class={inputClass}
            />
          </div>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs text-gray-400 truncate">{item.file.name}</p>
            {item.abcStatus !== 'done' && (
              <Button variant="secondary" onClick={onParse} disabled={parseDisabled || isParsePending(item)}>
                {PARSE_LABELS[item.abcStatus] || 'Parse ABC'}
              </Button>
            )}
          </div>
          {item.abcError && <p class="text-xs text-red-500">{item.abcError}</p>}
          {item.abcStatus === 'done' && (
            <div class="space-y-2">
              <div class="rounded border border-gray-200 bg-white p-2">
                <AbcViewer abc={item.abc} />
              </div>
              <details>
                <summary class="text-xs text-gray-500 cursor-pointer">Edit ABC</summary>
                <textarea
                  value={item.abc}
                  onInput={e => onChange({ abc: e.target.value })}
                  spellcheck={false}
                  rows={8}
                  disabled={disabled}
                  class="mt-1 w-full font-mono text-xs border border-gray-300 rounded-md p-2 bg-white text-gray-800"
                />
              </details>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="Remove"
          class="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none px-1"
        >×</button>
      </div>
    </div>
  );
}

function revokeItemUrls(item) {
  URL.revokeObjectURL(item.previewUrl);
  if (item.thumbUrl && item.thumbUrl !== item.previewUrl) URL.revokeObjectURL(item.thumbUrl);
}

export function FileImport({ createTune }) {
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const { isOffline } = useConnectivity();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const ocrBusy = useRef(false);
  const parseBusy = useRef(false);
  const parseAbort = useRef(null);

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  // Recognition pump: one file at a time; retriggers whenever items change
  // until nothing is queued. Images go straight to OCR; PDFs try the text
  // layer first and only OCR a rendered page when there isn't one.
  useEffect(() => {
    if (ocrBusy.current) return;
    const next = items.find(it => it.ocrStatus === 'queued');
    if (!next) return;
    ocrBusy.current = true;
    updateItem(next.id, { ocrStatus: 'reading' });
    (async () => {
      let patch;
      try {
        let lines;
        let thumbUrl;
        if (next.isPdf) {
          const { lines: textLines, thumb, scanBlob } = await analyzePdf(next.file);
          if (thumb) thumbUrl = URL.createObjectURL(thumb);
          lines = scanBlob ? await recognizeLines(scanBlob) : textLines;
        } else {
          lines = await recognizeLines(next.file);
        }
        const { title, type } = extractTitleFromLines(lines);
        patch = current => ({
          ocrStatus: title ? 'done' : 'empty',
          // Don't clobber anything the user already typed.
          title: current.title || title,
          type: current.type || type || '',
          thumbUrl: thumbUrl || current.thumbUrl,
        });
      } catch (err) {
        console.error('Recognition failed for', next.file.name, err);
        patch = () => ({ ocrStatus: 'failed' });
      }
      ocrBusy.current = false;
      setItems(prev => prev.map(it => (it.id === next.id ? { ...it, ...patch(it) } : it)));
    })();
  }, [items]);

  // ABC recognition pump: files queued by their Parse button or "Parse all" go to the
  // recognition service one at a time. abcStatus: null | 'queued' | 'parsing' | 'done'.
  useEffect(() => {
    if (parseBusy.current) return;
    const next = items.find(it => it.abcStatus === 'queued');
    if (!next) return;
    parseBusy.current = true;
    updateItem(next.id, { abcStatus: 'parsing', abcError: '' });
    const controller = new AbortController();
    parseAbort.current = controller;
    (async () => {
      let patch;
      let stopQueue = false;
      try {
        const result = await recognizeFile(next, controller.signal);
        if (result.status === 'done') {
          const meta = parseAbcMeta(result.abc);
          patch = current => ({
            abcStatus: 'done',
            abc: result.abc,
            title: current.title || (meta.title !== 'Untitled' ? meta.title : ''),
            key: current.key || (meta.key && meta.key !== 'none' ? meta.key : ''),
          });
        } else {
          patch = () => ({
            abcStatus: null,
            abcError: result.error?.code === 'no_music_found' ? 'No sheet music found in this file.' : result.error?.message || 'Parsing failed.',
          });
        }
      } catch (err) {
        if (err.name === 'AbortError') return; // leaving the view
        console.error('ABC recognition failed for', next.file.name, err);
        stopQueue = err.code === 'quota_exceeded';
        patch = () => ({ abcStatus: null, abcError: err.message || 'Parsing failed.' });
      }
      parseBusy.current = false;
      setItems(prev => prev.map(it => {
        if (it.id === next.id) return { ...it, ...patch(it) };
        // Out of scans for today: the rest of the queue would fail the same way
        return stopQueue && it.abcStatus === 'queued' ? { ...it, abcStatus: null } : it;
      }));
    })();
  }, [items]);

  const queueParse = (ids) => {
    setItems(prev => prev.map(it => (ids.includes(it.id) && !it.abcStatus ? { ...it, abcStatus: 'queued', abcError: '' } : it)));
  };

  // Free object URLs and the OCR wasm heap when leaving the view.
  useEffect(() => () => {
    parseAbort.current?.abort();
    for (const it of itemsRef.current) revokeItemUrls(it);
    releaseOcrWorker();
  }, []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') || isPdfFile(f));
    e.target.value = '';
    if (files.length === 0) return;
    const newItems = files.map(file => {
      const previewUrl = URL.createObjectURL(file);
      const isPdf = isPdfFile(file);
      return {
        id: ++nextId,
        file,
        isPdf,
        previewUrl,
        thumbUrl: isPdf ? null : previewUrl, // PDF thumbs render during analysis
        title: '',
        type: '',
        key: '',
        tempo: '',
        ocrStatus: 'queued',
        error: '',
        abcStatus: null,
        abc: '',
        abcError: '',
      };
    });
    setItems(prev => [...prev, ...newItems]);
  };

  const removeItem = (id) => {
    setItems(prev => {
      const it = prev.find(i => i.id === id);
      if (it) revokeItemUrls(it);
      return prev.filter(i => i.id !== id);
    });
  };

  const handleAddAll = async () => {
    setAdding(true);
    let count = 0;
    const added = [];
    for (const item of itemsRef.current) {
      const title = item.title.trim();
      // Files still being parsed stay in the list to be added once their ABC is in
      if (!title || isParsePending(item)) continue;
      try {
        const record = await createTune({
          title,
          type: item.type.trim() || undefined,
          setting_key: item.key.trim() || undefined,
          canonical_tempo: item.tempo ? Number(item.tempo) : undefined,
          abc: item.abcStatus === 'done' && item.abc.trim() ? item.abc : undefined,
          labels: [],
          instruments: {},
        });
        const fd = new FormData();
        fd.append('file', item.file);
        fd.append('user', pb.authStore.record.id);
        fd.append('user_tune', record.id);
        fd.append('type', 'sheet_music');
        fd.append('main_source', 'true');
        await pb.collection('attachments').create(fd);
        count++;
        added.push(item.id);
        revokeItemUrls(item);
      } catch (err) {
        console.error('Failed to add', title, err);
        updateItem(item.id, { error: err.message || 'Failed to add tune' });
      }
    }
    if (added.length > 0) setItems(prev => prev.filter(it => !added.includes(it.id)));
    setAddedCount(prev => prev + count);
    setAdding(false);
  };

  const titledCount = items.filter(it => it.title.trim() && !isParsePending(it)).length;
  const untitledCount = items.filter(it => !it.title.trim() && !isParsePending(it)).length;
  const pendingCount = items.filter(isParsePending).length;
  const unparsed = items.filter(it => !it.abcStatus).map(it => it.id);

  const picker = (label) => (
    <label class={`inline-block px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${items.length === 0 ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
      {label}
      <input type="file" accept="image/*,.pdf,application/pdf" multiple onChange={handleFiles} class="hidden" />
    </label>
  );

  if (items.length === 0) {
    return (
      <div class="max-w-2xl space-y-3">
        <p class="text-sm text-gray-500">
          Upload photos, scans or PDFs of sheet music — one tune per file.
        </p>
        {picker('Choose files')}
        {addedCount > 0 && (
          <p class="text-sm text-gray-600">Added {addedCount} tune{addedCount !== 1 ? 's' : ''} to your collection.</p>
        )}
      </div>
    );
  }

  return (
    <div class="max-w-2xl space-y-3">
      <datalist id="tune-types-import">
        {TUNE_TYPES.map(t => <option key={t} value={t} />)}
      </datalist>

      <div class="space-y-3">
        {items.map(item => (
          <FileRow
            key={item.id}
            item={item}
            onChange={patch => updateItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            onParse={() => queueParse([item.id])}
            disabled={adding}
            parseDisabled={adding || isOffline}
          />
        ))}
      </div>

      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          {picker('Add more files')}
          {items.length > 1 && unparsed.length > 0 && (
            <Button variant="secondary" size="md" onClick={() => queueParse(unparsed)} disabled={adding || isOffline}>
              Parse all
            </Button>
          )}
        </div>
        <div class="flex items-center gap-3">
          {addedCount > 0 && (
            <span class="text-xs text-brand-700 dark:text-brand-400">{addedCount} added</span>
          )}
          <Button
            size="md"
            onClick={handleAddAll}
            disabled={titledCount === 0 || adding || isOffline}
            title={isOffline ? 'Unavailable offline' : undefined}
          >
            {adding ? 'Adding...' : `Add ${titledCount} tune${titledCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
      {untitledCount > 0 && (
        <p class="text-xs text-amber-600 text-right">
          {untitledCount} file{untitledCount !== 1 ? 's' : ''} without a title will be skipped.
        </p>
      )}
      {pendingCount > 0 && (
        <p class="text-xs text-gray-500 text-right">
          {pendingCount} still parsing: add {pendingCount !== 1 ? 'them' : 'it'} when done.
        </p>
      )}
    </div>
  );
}
