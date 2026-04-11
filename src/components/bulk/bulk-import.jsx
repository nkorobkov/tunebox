import { useState, useEffect, useRef } from 'preact/hooks';
import { searchTunes, getTune } from '../../lib/session-api';
import { buildAbcString, getDefaultTempo, parseAbcMeta } from '../../lib/abc-utils';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';

let nextId = 0;

function parseInput(text) {
  const trimmed = text.trim();
  if (/^X:\s*\d+/m.test(trimmed)) {
    const tunes = trimmed.split(/(?=^X:\s*\d+)/m).filter(Boolean);
    return tunes.map(raw => {
      const abc = raw.trim();
      const meta = parseAbcMeta(abc);
      return { id: ++nextId, title: meta.title, abc, meta };
    });
  }
  const titles = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  return titles.map(title => ({ id: ++nextId, title }));
}

function BulkRow({ item, selected, onToggle, onAddManually, importGetterRef, createTune }) {
  const [sessionResults, setSessionResults] = useState(null);
  const [tuneDetail, setTuneDetail] = useState(null);
  const [resultIndex, setResultIndex] = useState(0);
  const [selectedSetting, setSelectedSetting] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const searched = useRef(false);

  // Search session once on mount for title items
  useEffect(() => {
    if (item.abc || searched.current) return;
    searched.current = true;
    setLoading(true);
    searchTunes(item.title, 1).then(async (data) => {
      const tunes = data.tunes || [];
      setSessionResults(tunes);
      if (tunes.length > 0) {
        const detail = await getTune(tunes[0].id);
        setTuneDetail(detail);
      }
    }).catch(err => {
      console.error('Search failed for', item.title, err);
      setSessionResults([]);
    }).finally(() => setLoading(false));
  }, []);

  const navigateResult = async (delta) => {
    const newIdx = resultIndex + delta;
    if (!sessionResults || newIdx < 0 || newIdx >= sessionResults.length) return;
    setResultIndex(newIdx);
    setSelectedSetting(0);
    setTuneDetail(null);
    setLoading(true);
    try {
      const detail = await getTune(sessionResults[newIdx].id);
      setTuneDetail(detail);
    } catch (err) {
      console.error('Failed to load tune:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddManually = async () => {
    setAdding(true);
    try {
      await createTune({ title: item.title, labels: [], instruments: {} });
      onAddManually();
    } finally {
      setAdding(false);
    }
  };

  // Keep import getter ref up to date
  const getImportData = () => {
    if (item.abc) {
      const m = item.meta;
      return {
        title: m.title,
        type: m.type,
        abc: item.abc,
        session_id: m.session_id,
        session_url: m.session_url,
        setting_key: m.key,
        author: m.author,
        canonical_tempo: m.type ? getDefaultTempo(m.type) : null,
        labels: [],
        instruments: {},
      };
    }
    if (tuneDetail && tuneDetail.settings[selectedSetting]) {
      const setting = tuneDetail.settings[selectedSetting];
      return {
        title: tuneDetail.name,
        type: tuneDetail.type,
        abc: buildAbcString(tuneDetail.name, tuneDetail.type, setting.key, setting.abc),
        session_id: tuneDetail.id,
        session_url: tuneDetail.url,
        setting_key: setting.key,
        canonical_tempo: getDefaultTempo(tuneDetail.type),
        labels: [],
        instruments: {},
      };
    }
    return null;
  };
  importGetterRef.current = getImportData;

  let previewAbc = null;
  if (item.abc) {
    previewAbc = item.abc;
  } else if (tuneDetail && tuneDetail.settings[selectedSetting]) {
    const s = tuneDetail.settings[selectedSetting];
    previewAbc = buildAbcString(tuneDetail.name, tuneDetail.type, s.key, s.abc);
  }

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          class="mt-1 cursor-pointer"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900">{item.title}</span>
              {item.abc && item.meta.type && (
                <span class="text-xs text-gray-400 capitalize">{item.meta.type}</span>
              )}
              {item.abc && item.meta.key && (
                <span class="text-xs text-gray-400">{item.meta.key}</span>
              )}
              {item.abc && item.meta.session_id && (
                <span class="text-xs text-gray-400">Session #{item.meta.session_id}</span>
              )}
              {!item.abc && sessionResults && sessionResults.length > 0 && tuneDetail && (
                <span class="text-xs text-gray-400 capitalize">{tuneDetail.type}</span>
              )}
              {!item.abc && sessionResults && sessionResults.length === 0 && (
                <span class="text-xs text-red-400">No results on Session</span>
              )}
            </div>
            {!item.abc && sessionResults && sessionResults.length > 1 && (
              <div class="flex items-center gap-1">
                <button
                  onClick={() => navigateResult(-1)}
                  disabled={resultIndex === 0 || loading}
                  class="px-2 py-0.5 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                >&lt;</button>
                <span class="text-xs text-gray-400">{resultIndex + 1}/{sessionResults.length}</span>
                <button
                  onClick={() => navigateResult(1)}
                  disabled={resultIndex >= sessionResults.length - 1 || loading}
                  class="px-2 py-0.5 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                >&gt;</button>
              </div>
            )}
          </div>

          {loading && !previewAbc && (
            <p class="text-sm text-gray-400">Searching...</p>
          )}

          {!item.abc && tuneDetail && tuneDetail.settings.length > 1 && (
            <div class="flex items-center gap-2 mb-2">
              <label class="text-xs text-gray-500">Setting:</label>
              <select
                value={selectedSetting}
                onChange={e => setSelectedSetting(Number(e.target.value))}
                class="text-sm border border-gray-300 rounded px-2 py-1"
              >
                {tuneDetail.settings.map((s, i) => (
                  <option key={i} value={i}>#{i + 1} — {s.key}</option>
                ))}
              </select>
            </div>
          )}

          {previewAbc && (
            <div class="bg-gray-50 rounded p-3 space-y-3">
              <AbcViewer abc={previewAbc} />
              <AbcPlayer abc={previewAbc} defaultTempo={
                item.abc ? 120 : getDefaultTempo(tuneDetail?.type)
              } />
            </div>
          )}

          {!item.abc && (
            <button
              onClick={handleAddManually}
              disabled={adding}
              class="mt-2 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              {adding ? 'Adding...' : 'Add manually (title only)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function BulkImport({ createTune }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const importGettersRef = useRef({});

  const handleParse = () => {
    const parsed = parseInput(text);
    setItems(parsed);
    setSelected(new Set(parsed.map(it => it.id)));
    importGettersRef.current = {};
    setImportedCount(0);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
    setSelected(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAddSelected = async () => {
    setImporting(true);
    let count = 0;
    const toRemove = [];
    const seenSessionIds = new Set();

    for (const item of items) {
      if (!selected.has(item.id)) continue;
      const getter = importGettersRef.current[item.id];
      if (!getter) continue;
      const ref = getter;
      const data = ref.current?.();
      if (!data) continue;

      // Dedupe by session_id
      if (data.session_id) {
        if (seenSessionIds.has(data.session_id)) {
          toRemove.push(item.id);
          continue;
        }
        seenSessionIds.add(data.session_id);
      }

      try {
        await createTune({ ...data, user: undefined });
        count++;
        toRemove.push(item.id);
      } catch (err) {
        console.error('Failed to import:', item.title, err);
      }
    }

    if (toRemove.length > 0) {
      setItems(prev => prev.filter(it => !toRemove.includes(it.id)));
      setSelected(prev => {
        const next = new Set(prev);
        for (const id of toRemove) next.delete(id);
        return next;
      });
    }

    setImportedCount(prev => prev + count);
    setImporting(false);
  };

  if (!items) {
    return (
      <div class="max-w-2xl space-y-3">
        <p class="text-sm text-gray-500">
          Paste either a list of tune titles (one per line) or an ABC tunebook with multiple tunes.
        </p>
        <textarea
          value={text}
          onInput={e => setText(e.target.value)}
          placeholder={"Morrison's Jig\nThe Kesh\nCooley's Reel\n\n— or paste ABC tunebook —\n\nX:1\nT:Morrison's Jig\nM:6/8\n..."}
          class="w-full h-48 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleParse}
          disabled={!text.trim()}
          class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          Parse & Preview
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div class="text-center py-8">
        {importedCount > 0 ? (
          <p class="text-gray-600">Added {importedCount} tune{importedCount !== 1 ? 's' : ''} to your collection.</p>
        ) : (
          <p class="text-gray-400">No tunes to import.</p>
        )}
        <button
          onClick={() => { setItems(null); setText(''); }}
          class="mt-3 text-sm text-blue-600 hover:underline cursor-pointer"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">
            {selected.size} of {items.length} selected
          </span>
          <button
            onClick={() => setSelected(new Set(items.map(it => it.id)))}
            class="text-xs text-blue-600 hover:underline cursor-pointer"
          >Select all</button>
          <button
            onClick={() => setSelected(new Set())}
            class="text-xs text-blue-600 hover:underline cursor-pointer"
          >Deselect all</button>
        </div>
        <div class="flex items-center gap-3">
          {importedCount > 0 && (
            <span class="text-xs text-green-600">{importedCount} added</span>
          )}
          <button
            onClick={handleAddSelected}
            disabled={selected.size === 0 || importing}
            class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer"
          >
            {importing ? 'Adding...' : `Add Selected (${selected.size})`}
          </button>
        </div>
      </div>

      <div class="space-y-3">
        {items.map(item => (
          <BulkRowWrapper
            key={item.id}
            item={item}
            selected={selected.has(item.id)}
            onToggle={() => toggleSelect(item.id)}
            onAddManually={() => removeItem(item.id)}
            gettersMap={importGettersRef.current}
            createTune={createTune}
          />
        ))}
      </div>

      {items.length > 3 && (
        <div class="flex justify-end">
          <button
            onClick={handleAddSelected}
            disabled={selected.size === 0 || importing}
            class="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer"
          >
            {importing ? 'Adding...' : `Add Selected (${selected.size})`}
          </button>
        </div>
      )}
    </div>
  );
}

// Thin wrapper to create a stable ref per item
function BulkRowWrapper({ item, selected, onToggle, onAddManually, gettersMap, createTune }) {
  const ref = useRef(null);
  gettersMap[item.id] = ref;
  return (
    <BulkRow
      item={item}
      selected={selected}
      onToggle={onToggle}
      onAddManually={onAddManually}
      importGetterRef={ref}
      createTune={createTune}
    />
  );
}
