import { useState, useMemo } from 'preact/hooks';
import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { SessionSearch } from '../components/search/session-search';
import { SearchResults } from '../components/search/search-results';
import { TuneForm } from '../components/tune/tune-form';
import { BulkImport } from '../components/bulk/bulk-import';
import { TunebookImport } from '../components/bulk/tunebook-import';
import { LoadingIndicator } from '../components/loading-indicator';
import { searchTunes } from '../lib/session-api';
import { useTunes } from '../hooks/use-tunes';
import { OfflineBanner } from '../components/common/offline-banner';
import { useConnectivity } from '../lib/connectivity';

const VIEWS = [
  { value: 'search', label: 'Search The Session' },
  { value: 'manual', label: 'Add manually' },
  { value: 'bulk', label: 'Bulk import' },
  { value: 'tunebook', label: 'Import session tunebook' },
];

export function AddTunePage() {
  const { tunes, createTune } = useTunes();
  const { isOffline } = useConnectivity();
  const [view, setView] = useState('search'); // 'search' | 'manual' | 'bulk' | 'tunebook'

  const existingSessionIds = useMemo(() => {
    const set = new Set();
    for (const t of tunes) {
      if (t.session_id) set.add(t.session_id);
    }
    return set;
  }, [tunes]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [currentQuery, setCurrentQuery] = useState('');

  const handleSearch = async (query, pageNum = 1) => {
    setLoading(true);
    setCurrentQuery(query);
    setPage(pageNum);
    try {
      const data = await searchTunes(query, pageNum);
      setResults(data.tunes || []);
      setTotalPages(data.pages || 0);
    } catch (err) {
      console.error('Search failed:', err);
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
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Add tune</h1>

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

      {/* Search The Session */}
      {view === 'search' && (
        <>
          <div class="mb-6">
            <SessionSearch onSearch={handleSearch} />
          </div>

          {loading && (
            <LoadingIndicator text="Searching" />
          )}

          {results && !loading && (
            <>
              {results.length === 0 ? (
                <p class="text-gray-400 text-center py-8">No tunes found.</p>
              ) : (
                <>
                  <SearchResults results={results} onImport={handleImport} />
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

      {/* Session Tunebook Import */}
      {view === 'tunebook' && (
        <TunebookImport createTune={createTune} existingSessionIds={existingSessionIds} />
      )}
    </Shell>
  );
}
