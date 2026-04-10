import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { SessionSearch } from '../components/search/session-search';
import { SearchResults } from '../components/search/search-results';
import { searchTunes } from '../lib/session-api';
import { pb } from '../lib/pb';

export function SearchPage() {
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
    const record = await pb.collection('user_tunes').create({
      ...tuneData,
      user: pb.authStore.record.id,
    });
    route(`/tune/${record.id}`);
  };

  return (
    <Shell>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Search The Session</h1>

      <div class="mb-6">
        <SessionSearch onSearch={handleSearch} />
      </div>

      {loading && (
        <p class="text-gray-400 text-center py-8">Searching...</p>
      )}

      {results && !loading && (
        <>
          {results.length === 0 ? (
            <p class="text-gray-400 text-center py-8">No tunes found.</p>
          ) : (
            <>
              <SearchResults results={results} onImport={handleImport} />

              {/* Pagination */}
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
    </Shell>
  );
}
