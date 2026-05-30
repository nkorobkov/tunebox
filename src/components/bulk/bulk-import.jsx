import { useState } from 'preact/hooks';
import { parseAbcMeta } from '../../lib/abc-utils';
import { ImportList } from './import-list';

let nextId = 0;

function parseInput(text) {
  const trimmed = text.trim();
  if (/^X:\s*\d+/m.test(trimmed)) {
    const tunes = trimmed.split(/(?=^X:\s*\d+)/m).filter(Boolean);
    return tunes.map(raw => {
      const abc = raw.trim();
      const meta = parseAbcMeta(abc);
      return { id: ++nextId, title: meta.title, abc, meta };
    });
  }
  const titles = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  return titles.map(title => ({ id: ++nextId, title }));
}

export function BulkImport({ createTune, existingSessionIds }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState(null);

  const handleParse = () => {
    const parsed = parseInput(text);
    const existing = existingSessionIds || new Set();
    const marked = parsed.map(it => {
      const sid = it.meta?.session_id;
      return sid && existing.has(sid) ? { ...it, alreadyInLibrary: true } : it;
    });
    setItems(marked);
  };

  if (!items) {
    return (
      <div class="max-w-2xl space-y-3">
        <p class="text-sm text-gray-500">
          Paste either a list of tune titles (one per line) or an ABC tunebook with multiple tunes.
        </p>
        <textarea
          value={text}
          onInput={e => setText(e.target.value)}
          placeholder={"Morrison's Jig\nThe Kesh\nCooley's Reel\n\n— or paste ABC tunebook —\n\nX:1\nT:Morrison's Jig\nM:6/8\n..."}
          class="w-full h-48 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleParse}
          disabled={!text.trim()}
          class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          Parse & Preview
        </button>
      </div>
    );
  }

  return (
    <ImportList
      items={items}
      setItems={setItems}
      createTune={createTune}
      existingSessionIds={existingSessionIds}
      onDone={() => { setItems(null); setText(''); }}
    />
  );
}
