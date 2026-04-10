import { useState } from 'preact/hooks';

export function SessionSearch({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} class="flex gap-3">
      <input
        type="text"
        value={query}
        onInput={e => setQuery(e.target.value)}
        placeholder="Search tunes on The Session..."
        class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={!query.trim()}
        class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
      >
        Search
      </button>
    </form>
  );
}
