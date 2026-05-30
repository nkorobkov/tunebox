import { useState } from 'preact/hooks';
import { getAllTunebookTunes, parseSessionMemberRef } from '../../lib/session-api';
import { ImportList } from './import-list';

let nextId = 0;

export function TunebookImport({ createTune, existingSessionIds }) {
  const [input, setInput] = useState('');
  const [items, setItems] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    const memberId = parseSessionMemberRef(input);
    if (!memberId) {
      setError('Enter a thesession.org member URL or numeric member ID.');
      return;
    }
    setError(null);
    setLoading(true);
    setProgress(null);
    try {
      const data = await getAllTunebookTunes(memberId, (p) => setProgress(p));
      setMember(data.member);
      const existing = existingSessionIds || new Set();
      const parsed = data.tunes.map(t => ({
        id: ++nextId,
        title: t.name,
        session_id: t.id,
        type: t.type,
        sessionUrl: t.url,
        alreadyInLibrary: existing.has(t.id),
      }));
      setItems(parsed);
    } catch (err) {
      console.error('Failed to fetch tunebook:', err);
      setError('Could not load tunebook. Check the URL/ID and try again.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setItems(null);
    setMember(null);
    setInput('');
    setError(null);
  };

  if (!items) {
    return (
      <div class="max-w-2xl space-y-3">
        <p class="text-sm text-gray-500">
          Paste a member's tunebook URL (e.g.{' '}
          <code class="text-xs bg-gray-100 px-1 rounded">https://thesession.org/members/1/tunebook</code>
          ) or just the numeric member ID.
        </p>
        <input
          type="text"
          value={input}
          onInput={e => setInput(e.target.value)}
          placeholder="https://thesession.org/members/1/tunebook"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p class="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleFetch}
          disabled={loading || !input.trim()}
          class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {loading
            ? (progress ? `Fetching page ${progress.page}/${progress.totalPages}…` : 'Fetching…')
            : 'Fetch Tunebook'}
        </button>
      </div>
    );
  }

  const newCount = items.filter(it => !it.alreadyInLibrary).length;
  const dupCount = items.length - newCount;

  return (
    <div class="space-y-4">
      <div class="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            {member ? `${member.name}'s tunebook` : 'Tunebook'}
          </h2>
          <p class="text-sm text-gray-500">
            {items.length} tunes
            {dupCount > 0 && ` — ${dupCount} already in your library`}
            {newCount > 0 && `, ${newCount} new`}
          </p>
        </div>
        <button
          onClick={handleReset}
          class="text-sm text-blue-600 hover:underline cursor-pointer"
        >
          Use a different member
        </button>
      </div>

      <ImportList
        items={items}
        setItems={setItems}
        createTune={createTune}
        existingSessionIds={existingSessionIds}
        onDone={handleReset}
        emptyMessage="All tunes from this tunebook have been imported."
      />
    </div>
  );
}
