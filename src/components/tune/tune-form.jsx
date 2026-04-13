import { useState } from 'preact/hooks';
import { parseAbcMeta, getDefaultTempo } from '../../lib/abc-utils';

const TUNE_TYPES = ['reel', 'jig', 'slip jig', 'hornpipe', 'polka', 'slide', 'waltz', 'mazurka', 'march', 'barndance', 'other'];

export function TuneForm({ initial = {}, onSubmit, submitLabel = 'Save' }) {
  const [title, setTitle] = useState(initial.title || '');
  const [type, setType] = useState(initial.type || '');
  const [settingKey, setSettingKey] = useState(initial.setting_key || '');
  const [canonicalTempo, setCanonicalTempo] = useState(initial.canonical_tempo || '');
  const [author, setAuthor] = useState(initial.author || '');
  const [abc, setAbc] = useState(initial.abc || '');
  const [notes, setNotes] = useState(initial.notes || '');
  const [sourceUrl, setSourceUrl] = useState(initial.source_url || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        type: type || undefined,
        setting_key: settingKey || undefined,
        canonical_tempo: canonicalTempo ? Number(canonicalTempo) : undefined,
        author: author || undefined,
        abc: abc || undefined,
        notes: notes || undefined,
        source_url: sourceUrl || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={title}
          onInput={e => setTitle(e.target.value)}
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <input
            type="text"
            value={type}
            onInput={e => setType(e.target.value)}
            list="tune-types"
            placeholder="e.g. reel, jig, march"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <datalist id="tune-types">
            {TUNE_TYPES.map(t => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Key</label>
          <input
            type="text"
            value={settingKey}
            onInput={e => setSettingKey(e.target.value)}
            placeholder="e.g. Dmajor"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Canonical Tempo (BPM)</label>
          <input
            type="number"
            value={canonicalTempo}
            onInput={e => setCanonicalTempo(e.target.value)}
            placeholder="e.g. 120"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Author</label>
          <input
            type="text"
            value={author}
            onInput={e => setAuthor(e.target.value)}
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
        <input
          type="url"
          value={sourceUrl}
          onInput={e => setSourceUrl(e.target.value)}
          placeholder="https://..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">ABC Notation</label>
        <textarea
          value={abc}
          onInput={e => {
            const val = e.target.value;
            setAbc(val);
            if (val.includes('X:')) {
              const meta = parseAbcMeta(val);
              if (meta.title && meta.title !== 'Untitled' && !title) setTitle(meta.title);
              if (meta.type && !type) setType(meta.type);
              if (meta.key && !settingKey) setSettingKey(meta.key);
              if (meta.author && !author) setAuthor(meta.author);
              if (meta.source && !sourceUrl) setSourceUrl(meta.source);
              if (meta.session_url && !sourceUrl) setSourceUrl(meta.session_url);
              if (meta.type && !canonicalTempo) setCanonicalTempo(getDefaultTempo(meta.type));
            }
          }}
          rows={8}
          placeholder="X:1&#10;T:Tune Name&#10;M:4/4&#10;K:D&#10;..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onInput={e => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes about this tune..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !title}
        class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
