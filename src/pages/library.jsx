import { useState, useMemo } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { TuneCard } from '../components/tune/tune-card';
import { LabelFilter } from '../components/library/label-filter';
import { useTunes } from '../hooks/use-tunes';
import { isDue, isNew } from '../lib/spaced-repetition';

export function LibraryPage() {
  const { tunes, loading } = useTunes();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState(null);

  const dueCount = useMemo(() => tunes.filter(isDue).length, [tunes]);
  const newCount = useMemo(() => tunes.filter(isNew).length, [tunes]);

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
            {dueCount > 0 && ` \u00b7 ${dueCount} due`}
            {newCount > 0 && ` \u00b7 ${newCount} new`}
          </p>
        </div>
        <div class="flex items-center gap-3">
          {(dueCount > 0 || newCount > 0) && (
            <a
              href="/practice"
              class="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 no-underline"
            >
              Practice ({dueCount + newCount})
            </a>
          )}
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
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div class="flex justify-center gap-3">
              <a href="/add" class="text-sm text-blue-600 hover:underline">Add manually</a>
              <span class="text-gray-300">or</span>
              <a href="/search" class="text-sm text-blue-600 hover:underline">Search The Session</a>
            </div>
          )}
        </div>
      ) : (
        <div class="grid gap-3">
          {filtered.map(tune => (
            <TuneCard key={tune.id} tune={tune} />
          ))}
        </div>
      )}
    </Shell>
  );
}
