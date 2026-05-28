import { useState, useMemo } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { TuneCard, SetGroup } from '../components/tune/tune-card';
import { LabelFilter } from '../components/library/label-filter';
import { LoadingIndicator } from '../components/loading-indicator';
import { useTunes } from '../hooks/use-tunes';
import { useAuth } from '../lib/auth';
import { instrumentProficiency } from '../lib/practice-algorithm';

// Normalize set name for grouping: lowercase, collapse whitespace, strip punctuation
function normalizeSetName(name) {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function TuneList({ tunes }) {
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
          <SetGroup key={`set:${item.name}`} name={item.name} tunes={item.tunes} />
        ) : (
          <TuneCard key={item.tune.id} tune={item.tune} />
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
  const { tunes, loading } = useTunes();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [labelFilter, setLabelFilter] = useState(null);
  const [proficiencyFilter, setProficiencyFilter] = useState('');
  const [instrumentFilter, setInstrumentFilter] = useState('');

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
    if (labelFilter) {
      const [type, value] = labelFilter.split(':');
      result = result.filter(t =>
        (t.labels || []).some(l => l.type === type && l.value === value)
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
  }, [tunes, search, typeFilter, labelFilter, proficiencyFilter, instrumentFilter, sort]);

  const types = useMemo(() =>
    [...new Set(tunes.map(t => t.type).filter(Boolean))].sort(),
    [tunes]
  );

  return (
    <Shell>
      <div class="flex items-center justify-end mb-6">
        <div class="hidden lg:flex items-center gap-3">
          <a
            href="/practice"
            class="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 no-underline"
          >
            Practice
          </a>
          <a
            href="/add"
            class="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 no-underline"
          >
            + Add Tune
          </a>
        </div>
      </div>

      {/* Filters */}
      <div class="space-y-3 mb-4">
        <div class="flex gap-3">
          <input
            type="text"
            value={search}
            onInput={e => setSearch(e.target.value)}
            placeholder={`Search ${tunes.length} tune${tunes.length !== 1 ? 's' : ''}...`}
            class="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            class="hidden lg:block min-w-0 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            class="flex items-center justify-center gap-0.5 w-10 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          selectedLabel={labelFilter}
          onSelect={setLabelFilter}
          proficiencyFilter={proficiencyFilter}
          onProficiencyChange={setProficiencyFilter}
          instrumentFilter={instrumentFilter}
          onInstrumentChange={setInstrumentFilter}
          instruments={allInstruments}
        />
      </div>

      {/* Tune List */}
      {loading ? (
        <LoadingIndicator />
      ) : filtered.length === 0 ? (
        <div class="text-center py-12">
          <p class="text-gray-400 mb-4">
            {tunes.length === 0 ? 'No tunes yet.' : 'No tunes match your filters.'}
          </p>
          {tunes.length === 0 && (
            <a href="/add" class="text-sm text-blue-600 hover:underline">Add a tune</a>
          )}
        </div>
      ) : (
        <TuneList tunes={filtered} />
      )}
    </Shell>
  );
}
