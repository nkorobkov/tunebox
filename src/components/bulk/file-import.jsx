import { useState, useEffect, useRef } from 'preact/hooks';
import { pb } from '../../lib/pb';
import { recognizeLines, releaseOcrWorker } from '../../lib/ocr';
import { analyzePdf, isPdfFile } from '../../lib/pdf-import';
import { extractTitleFromLines } from '../../lib/ocr-title';
import { TUNE_TYPES } from '../tune/tune-form';
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

function FileRow({ item, onChange, onRemove, disabled }) {
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
          <p class="text-xs text-gray-400 truncate">{item.file.name}</p>
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

  // Free object URLs and the OCR wasm heap when leaving the view.
  useEffect(() => () => {
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
      if (!title) continue;
      try {
        const record = await createTune({
          title,
          type: item.type.trim() || undefined,
          setting_key: item.key.trim() || undefined,
          canonical_tempo: item.tempo ? Number(item.tempo) : undefined,
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

  const titledCount = items.filter(it => it.title.trim()).length;
  const untitledCount = items.length - titledCount;

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
            disabled={adding}
          />
        ))}
      </div>

      <div class="flex items-center justify-between flex-wrap gap-2">
        {picker('Add more files')}
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
    </div>
  );
}
