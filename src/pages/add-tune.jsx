import { useState, useMemo } from 'preact/hooks';
import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { SessionSearch } from '../components/search/session-search';
import { SearchResults, sessionTuneRecord } from '../components/search/search-results';
import { TuneForm } from '../components/tune/tune-form';
import { BulkImport } from '../components/bulk/bulk-import';
import { TunebookImport } from '../components/bulk/tunebook-import';
import { FileImport } from '../components/bulk/file-import';
import { LoadingIndicator } from '../components/loading-indicator';
import { searchTunes, getTune } from '../lib/session-api';
import { filterPopularTunes } from '../lib/popular-tunes';
import { useTunes } from '../hooks/use-tunes';
import { OfflineBanner } from '../components/common/offline-banner';
import { useConnectivity } from '../lib/connectivity';

const VIEWS = [
  { value: 'search', label: 'Search' },
  { value: 'manual', label: 'Add manually' },
  { value: 'files', label: 'From file/picture' },
  { value: 'bulk', label: 'Bulk import' },
  { value: 'tunebook', label: 'Import session tunebook' },
];

const POPULAR_PAGE = 30;

export function AddTunePage() {
  const { tunes, createTune } = useTunes();
  const { isOffline } = useConnectivity();
  const [view, setView] = useState('search'); // 'search' | 'manual' | 'files' | 'bulk' | 'tunebook'

  const existingSessionIds = useMemo(() => {
    const set = new Set();
    for (const t of tunes) {
      if (t.session_id) set.add(t.session_id);
    }
    return set;
  }, [tunes]);
  // thesession id → library record id, for "In library" links.
  const librarySessionIds = useMemo(() => {
    const map = new Map();
    for (const t of tunes) {
      if (t.session_id) map.set(String(t.session_id), t.id);
    }
    return map;
  }, [tunes]);

  const [query, setQuery] = useState('');
  const [popularLimit, setPopularLimit] = useState(POPULAR_PAGE);
  const popular = useMemo(() => filterPopularTunes(query), [query]);
  const [quickAddStatus, setQuickAddStatus] = useState({}); // session id → 'adding' | 'failed'

  const quickAdd = {
    status: (id) => quickAddStatus[id] || null,
    href: (id) => {
      const recordId = librarySessionIds.get(String(id));
      return recordId ? `/tune/${recordId}` : null;
    },
    add: async (tune) => {
      setQuickAddStatus(s => ({ ...s, [tune.id]: 'adding' }));
      try {
        const detail = await getTune(tune.id);
        const setting = detail.settings?.[0];
        if (!setting) throw new Error('Tune has no settings');
        await createTune(sessionTuneRecord(detail, setting));
        setQuickAddStatus(s => ({ ...s, [tune.id]: null }));
      } catch (err) {
        console.error('Quick add failed:', err);
        setQuickAddStatus(s => ({ ...s, [tune.id]: 'failed' }));
      }
    },
  };
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchError, setSearchError] = useState(false);
  // Full-archive results belong to the query that produced them; once the box
  // is edited, the filtered popular list takes over again until Enter.
  const showArchive = (results || loading) && currentQuery === query.trim();

  const handleQueryChange = (q) => {
    setQuery(q);
    setPopularLimit(POPULAR_PAGE);
  };

  const handleSearch = async (query, pageNum = 1) => {
    setLoading(true);
    setCurrentQuery(query);
    setPage(pageNum);
    setSearchError(false);
    if (query !== currentQuery) setResults(null);
    try {
      const data = await searchTunes(query, pageNum);
      setResults(data.tunes || []);
      setTotalPages(data.pages || 0);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
      setSearchError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (tuneData) => {
    const record = await createTune(tuneData);
    route(`/tune/${record.id}`);
  };

  const handleManualSubmit = async (data) => {
    const record = await createTune({
      ...data,
      labels: [],
      instruments: {},
    });
    route(`/tune/${record.id}`);
  };

  return (
    <Shell>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Add tune</h1>
        <div class="flex flex-wrap gap-2">
          {/* Static pages outside the SPA (public/collections/); `native` keeps preact-router out of it. */}
          <a
            href="/collections/"
            native
            class="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Browse tune collections
          </a>
        </div>
      </div>

      <OfflineBanner message="Adding tunes is unavailable offline. Reconnect to add or import tunes." />

      {/* View switcher */}
      <div class="flex flex-wrap gap-2 mb-6">
        {VIEWS.map(v => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            class={`px-3 py-1.5 text-sm rounded-md cursor-pointer ${view === v.value ? 'bg-brand-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Search: popular tunes filtered locally, Enter searches The Session's full archive */}
      {view === 'search' && (
        <>
          <div class="mb-6">
            <SessionSearch query={query} onQueryChange={handleQueryChange} onSearch={handleSearch} />
          </div>

          {!showArchive && (
            <>
              <div class="flex items-baseline justify-between gap-3 mb-2">
                <h2 class="text-sm font-medium text-gray-700">
                  {query.trim() ? 'Popular tunes' : 'Most popular on The Session'}
                </h2>
                {query.trim() && popular.length > 0 && (
                  <span class="text-xs text-gray-400">Press Enter to search the full archive</span>
                )}
              </div>
              {popular.length === 0 ? (
                <p class="text-gray-400 text-center py-8">
                  No popular tunes match. Press Enter to search the full archive.
                </p>
              ) : (
                <>
                  <SearchResults results={popular.slice(0, popularLimit)} onImport={handleImport} quickAdd={quickAdd} />
                  {popular.length > popularLimit && (
                    <div class="text-center mt-4">
                      <button
                        onClick={() => setPopularLimit(l => l + POPULAR_PAGE)}
                        class="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 cursor-pointer"
                      >
                        Show more
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {showArchive && loading && (
            <LoadingIndicator text="Searching" />
          )}

          {showArchive && results && !loading && (
            <>
              {results.length === 0 ? (
                <p class="text-gray-400 text-center py-8">{searchError ? 'Search failed. Try again.' : 'No tunes found.'}</p>
              ) : (
                <>
                  <SearchResults results={results} onImport={handleImport} quickAdd={quickAdd} />
                  {totalPages > 1 && (
                    <div class="flex items-center justify-center gap-3 mt-6">
                      <button
                        onClick={() => handleSearch(currentQuery, page - 1)}
                        disabled={page <= 1}
                        class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                      >
                        Previous
                      </button>
                      <span class="text-sm text-gray-500">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => handleSearch(currentQuery, page + 1)}
                        disabled={page >= totalPages}
                        class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-30 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Manual Add */}
      {view === 'manual' && (
        <div class="max-w-2xl">
          <TuneForm onSubmit={handleManualSubmit} submitLabel="Add to collection" />
        </div>
      )}

      {/* Bulk Import */}
      {view === 'bulk' && (
        <BulkImport createTune={createTune} existingSessionIds={existingSessionIds} />
      )}

      {/* File Import (photos/scans/PDFs of sheet music) */}
      {view === 'files' && (
        <FileImport createTune={createTune} />
      )}

      {/* Session Tunebook Import */}
      {view === 'tunebook' && (
        <TunebookImport createTune={createTune} existingSessionIds={existingSessionIds} />
      )}
    </Shell>
  );
}
