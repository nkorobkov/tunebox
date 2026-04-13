import { useState, useMemo } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { TuneCard, SetGroup } from '../components/tune/tune-card';
import { LabelFilter } from '../components/library/label-filter';
import { useTunes } from '../hooks/use-tunes';

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

export function LibraryPage() {
  const { tunes, loading } = useTunes();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState(null);

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
    return result;
  }, [tunes, search, typeFilter, labelFilter]);

  const types = useMemo(() =>
    [...new Set(tunes.map(t => t.type).filter(Boolean))].sort(),
    [tunes]
  );

  return (
    <Shell>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">My Tunes</h1>
          <p class="text-sm text-gray-500 mt-1">
            {tunes.length} tune{tunes.length !== 1 ? 's' : ''}
          </p>
        </div>
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
            placeholder="Search tunes..."
            class="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            class="min-w-0 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <LabelFilter
          tunes={tunes}
          selectedLabel={labelFilter}
          onSelect={setLabelFilter}
        />
      </div>

      {/* Tune List */}
      {loading ? (
        <p class="text-gray-400 text-center py-12">Loading...</p>
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
