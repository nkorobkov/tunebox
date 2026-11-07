// Controlled search box: typing filters (the parent decides what), Enter or
// the button runs the full thesession.org search.
export function SessionSearch({ query, onQueryChange, onSearch }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} class="flex gap-3">
      <input
        type="search"
        value={query}
        onInput={e => onQueryChange(e.target.value)}
        placeholder="Search tunes…"
        autoFocus
        class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="submit"
        disabled={!query.trim()}
        class="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50 cursor-pointer"
      >
        Search
      </button>
    </form>
  );
}
