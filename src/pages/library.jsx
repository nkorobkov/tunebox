import { useState, useMemo } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { TuneCard, SetGroup } from '../components/tune/tune-card';
import { LabelFilter } from '../components/library/label-filter';
import { BulkToolbar } from '../components/library/bulk-toolbar';
import { ExportDialog } from '../components/library/export-dialog';
import { LoadingIndicator } from '../components/loading-indicator';
import { Button } from '../components/common/button';
import { useTunes } from '../hooks/use-tunes';
import { useAuth } from '../lib/auth';
import { instrumentProficiency } from '../lib/practice-algorithm';
import { getDefaultTempo } from '../lib/abc-utils';
import { addKnownTag } from '../lib/tag-store';

// Normalize set name for grouping: lowercase, collapse whitespace, strip punctuation
function normalizeSetName(name) {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function TuneList({ tunes, selectable = false, selectedIds, onToggleSelect }) {
  const items = [];
  const setMap = new Map(); // normalized key -> { displayName, entries }
  const inSet = new Set();

  for (const tune of tunes) {
    const setLabel = (tune.labels || []).find(l => l.type === 'set');
    if (setLabel) {
      const key = normalizeSetName(setLabel.value);
      if (!setMap.has(key)) {
        setMap.set(key, { displayName: setLabel.value, entries: [] });
      }
      setMap.get(key).entries.push({ tune, order: setLabel.order || 0 });
      inSet.add(tune.id);
    }
  }

  for (const [, group] of setMap) {
    group.entries.sort((a, b) => a.order - b.order);
  }

  const placedSets = new Set();
  for (const tune of tunes) {
    const setLabel = (tune.labels || []).find(l => l.type === 'set');
    if (setLabel) {
      const key = normalizeSetName(setLabel.value);
      if (!placedSets.has(key)) {
        placedSets.add(key);
        items.push({ type: 'set', name: setMap.get(key).displayName, tunes: setMap.get(key).entries.map(e => e.tune) });
      }
    } else if (!inSet.has(tune.id)) {
      items.push({ type: 'tune', tune });
    }
  }

  return (
    <div class="grid gap-3">
      {items.map(item =>
        item.type === 'set' ? (
          <SetGroup
            key={`set:${item.name}`}
            name={item.name}
            tunes={item.tunes}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ) : (
          <TuneCard
            key={item.tune.id}
            tune={item.tune}
            selectable={selectable}
            selected={selectable && selectedIds?.has(item.tune.id)}
            onToggleSelect={onToggleSelect}
          />
        )
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'a-z', label: 'A–Z' },
  { value: 'z-a', label: 'Z–A' },
];

function sortTunes(tunes, sort) {
  const sorted = [...tunes];
  switch (sort) {
    case 'oldest':
      sorted.sort((a, b) => a.created.localeCompare(b.created));
      break;
    case 'a-z':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'z-a':
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'newest':
    default:
      sorted.sort((a, b) => b.created.localeCompare(a.created));
      break;
  }
  return sorted;
}

export function LibraryPage() {
  const { tunes, loading, updateTune, deleteTune } = useTunes();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [labelFilters, setLabelFilters] = useState([]); // ["type:value", ...] — tunes must match all (AND)
  const [proficiencyFilter, setProficiencyFilter] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProgress, setBulkProgress] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [dialog, setDialog] = useState(null); // null | 'export' | 'print'

  // Collect all instruments across all tunes
  const allInstruments = useMemo(() => {
    const set = new Set();
    for (const t of tunes) {
      for (const name of Object.keys(t.instruments || {})) {
        set.add(name);
      }
    }
    // Also include user instruments
    if (user?.instruments) {
      for (const name of user.instruments) set.add(name);
    }
    return [...set].sort();
  }, [tunes, user]);

  const filtered = useMemo(() => {
    let result = tunes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.author?.toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      result = result.filter(t => t.type === typeFilter);
    }
    if (labelFilters.length > 0) {
      result = result.filter(t =>
        labelFilters.every(key => {
          const i = key.indexOf(':');
          const type = key.slice(0, i);
          const value = key.slice(i + 1);
          return (t.labels || []).some(l => l.type === type && l.value === value);
        })
      );
    }
    if (proficiencyFilter) {
      result = result.filter(t =>
        Object.keys(t.instruments || {}).some(name =>
          instrumentProficiency(t, name) === proficiencyFilter
        )
      );
    }
    if (instrumentFilter) {
      result = result.filter(t =>
        t.instruments && instrumentFilter in t.instruments
      );
    }
    return sortTunes(result, sort);
  }, [tunes, search, typeFilter, labelFilters, proficiencyFilter, instrumentFilter, sort]);

  const types = useMemo(() =>
    [...new Set(tunes.map(t => t.type).filter(Boolean))].sort(),
    [tunes]
  );

  // --- Bulk selection ---
  // Selected tunes in the current sort order (also the export/print order).
  const selectedTunes = useMemo(
    () => sortTunes(tunes.filter(t => selectedIds.has(t.id)), sort),
    [tunes, selectedIds, sort]
  );

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setDialog(null);
  };

  // Run an async operation over the selected tunes one by one, with progress.
  const runBulk = async (verb, fn) => {
    const targets = selectedTunes;
    let failed = 0;
    setBulkError('');
    for (const [i, tune] of targets.entries()) {
      setBulkProgress(`${verb} ${i + 1}/${targets.length}...`);
      try {
        await fn(tune);
      } catch (err) {
        failed++;
        console.error(`Bulk ${verb.toLowerCase()} failed for "${tune.title}":`, err);
      }
    }
    setBulkProgress('');
    if (failed > 0) setBulkError(`${verb} failed for ${failed} tune${failed !== 1 ? 's' : ''}.`);
  };

  const bulkAddTag = async (value) => {
    addKnownTag(value);
    await runBulk('Tagging', async (tune) => {
      const labels = tune.labels || [];
      if (labels.some(l => l.type === 'tag' && l.value === value)) return;
      await updateTune(tune.id, { labels: [...labels, { type: 'tag', value }] });
    });
  };

  const bulkStartLearning = async (instrument) => {
    await runBulk('Updating', async (tune) => {
      if (tune.instruments?.[instrument]) return;
      const target = tune.practice_tempo || tune.canonical_tempo || getDefaultTempo(tune.type);
      await updateTune(tune.id, {
        instruments: {
          ...(tune.instruments || {}),
          [instrument]: { keys: [], current_tempo: 0, target_tempo: target },
        },
      });
    });
  };

  const bulkDelete = async () => {
    await runBulk('Deleting', async (tune) => {
      await deleteTune(tune.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(tune.id);
        return next;
      });
    });
  };

  return (
    <Shell>
      {selectMode ? (
        <BulkToolbar
          selectedCount={selectedIds.size}
          totalCount={filtered.length}
          progress={bulkProgress}
          onSelectAll={() => setSelectedIds(new Set(filtered.map(t => t.id)))}
          onClear={() => setSelectedIds(new Set())}
          onExit={exitSelectMode}
          onAddTag={bulkAddTag}
          onStartLearning={bulkStartLearning}
          onDelete={bulkDelete}
          onExport={() => setDialog('export')}
          onPrint={() => setDialog('print')}
          instruments={allInstruments}
        />
      ) : (
        <div class="hidden lg:flex items-center justify-end mb-6">
          <div class="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setSelectMode(true)}>Select</Button>
            <Button variant="secondary" href="/add">+ Add tune</Button>
            <Button href="/practice">Practice</Button>
          </div>
        </div>
      )}

      {bulkError && (
        <div class="mb-4 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p class="text-sm text-red-700">{bulkError}</p>
          <button onClick={() => setBulkError('')} class="text-sm text-red-400 hover:text-red-600 cursor-pointer" aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Filters — pointless while the library is empty */}
      {tunes.length > 0 && (
      <div class="space-y-3 mb-4">
        <div class="flex gap-3">
          <input
            type="text"
            value={search}
            onInput={e => setSearch(e.target.value)}
            placeholder={`Search ${tunes.length} tune${tunes.length !== 1 ? 's' : ''}...`}
            class="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            class="hidden lg:block min-w-0 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={() => {
              const i = SORT_OPTIONS.findIndex(o => o.value === sort);
              setSort(SORT_OPTIONS[(i + 1) % SORT_OPTIONS.length].value);
            }}
            title={`Sort: ${SORT_OPTIONS.find(o => o.value === sort)?.label}`}
            aria-label={`Sort: ${SORT_OPTIONS.find(o => o.value === sort)?.label}`}
            class="flex items-center justify-center gap-0.5 w-10 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {sort === 'newest' || sort === 'oldest' ? (
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            ) : (
              <span class="text-xs font-bold leading-none">{sort === 'a-z' ? 'A' : 'Z'}</span>
            )}
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              {sort === 'newest' || sort === 'a-z' ? (
                <path d="M12 5v14m0 0l-6-6m6 6l6-6" />
              ) : (
                <path d="M12 19V5m0 0L6 11m6-6l6 6" />
              )}
            </svg>
          </button>
        </div>
        <LabelFilter
          tunes={tunes}
          selectedLabels={labelFilters}
          onToggleLabel={key => setLabelFilters(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
          )}
          onClearLabels={() => setLabelFilters([])}
          proficiencyFilter={proficiencyFilter}
          onProficiencyChange={setProficiencyFilter}
          instrumentFilter={instrumentFilter}
          onInstrumentChange={setInstrumentFilter}
          instruments={allInstruments}
        />
      </div>
      )}

      {/* Tune List */}
      {loading ? (
        <LoadingIndicator />
      ) : filtered.length === 0 ? (
        tunes.length === 0 ? (
          <div class="bg-white rounded-lg border border-gray-200 p-8 text-center max-w-md mx-auto mt-8">
            <h2 class="text-lg font-semibold text-gray-900">Start your tunebook</h2>
            <p class="text-sm text-gray-500 mt-2 mb-5">
              Search The Session for a tune you're working on, or add one of your own with ABC notation.
            </p>
            <Button size="md" href="/add">Add your first tune</Button>
          </div>
        ) : (
          <div class="text-center py-12">
            <p class="text-gray-400">No tunes match your filters.</p>
          </div>
        )
      ) : (
        <TuneList
          tunes={filtered}
          selectable={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {dialog && selectedTunes.length > 0 && (
        <ExportDialog
          tunes={selectedTunes}
          mode={dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </Shell>
  );
}
