import { useState } from 'preact/hooks';
import { TagInput } from '../tune/tag-input';
import { getKnownTags } from '../../lib/tag-store';
import { useConnectivity } from '../../lib/connectivity';

/**
 * Toolbar shown while the library is in select mode. Hosts the bulk
 * actions: tag, start learning, delete, export, print.
 */
export function BulkToolbar({
  selectedCount,
  totalCount,
  progress,
  onSelectAll,
  onClear,
  onExit,
  onAddTag,
  onStartLearning,
  onDelete,
  onExport,
  onPrint,
  instruments,
}) {
  const [panel, setPanel] = useState(null); // null | 'tag' | 'learn' | 'delete'
  const [tagValue, setTagValue] = useState('');
  const [customInstrument, setCustomInstrument] = useState('');
  const { isOffline } = useConnectivity();

  const busy = Boolean(progress);
  const none = selectedCount === 0;
  const offlineTitle = isOffline ? 'Unavailable offline' : undefined;

  const closePanel = () => {
    setPanel(null);
    setTagValue('');
    setCustomInstrument('');
  };

  const submitTag = (value) => {
    const v = (value || '').trim();
    if (!v) return;
    closePanel();
    onAddTag(v);
  };

  const submitInstrument = (name) => {
    const v = (name || '').trim();
    if (!v) return;
    closePanel();
    onStartLearning(v);
  };

  const actionBtn = 'text-sm px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div class="mb-6 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-gray-800">
          {selectedCount} selected
        </span>
        <button
          onClick={onSelectAll}
          disabled={busy}
          class="text-sm text-blue-600 hover:underline cursor-pointer disabled:opacity-40"
        >
          Select all {totalCount}
        </button>
        {selectedCount > 0 && (
          <button
            onClick={onClear}
            disabled={busy}
            class="text-sm text-gray-400 hover:underline cursor-pointer disabled:opacity-40"
          >
            Clear
          </button>
        )}

        <div class="flex-1" />

        {busy ? (
          <span class="text-sm text-gray-500">{progress}</span>
        ) : (
          <>
            <button
              onClick={() => setPanel(panel === 'tag' ? null : 'tag')}
              disabled={none || isOffline}
              title={offlineTitle}
              class={actionBtn}
            >
              + Tag
            </button>
            <button
              onClick={() => setPanel(panel === 'learn' ? null : 'learn')}
              disabled={none || isOffline}
              title={offlineTitle}
              class={actionBtn}
            >
              Learn on...
            </button>
            <button onClick={onExport} disabled={none} class={actionBtn}>
              Export
            </button>
            <button onClick={onPrint} disabled={none} class={actionBtn}>
              Print
            </button>
            <button
              onClick={() => setPanel('delete')}
              disabled={none || isOffline}
              title={offlineTitle}
              class="text-sm px-2.5 py-1.5 border border-red-300 text-red-600 rounded-md hover:bg-red-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </>
        )}

        <button
          onClick={onExit}
          disabled={busy}
          class="text-sm px-2.5 py-1.5 text-gray-500 hover:text-gray-700 cursor-pointer disabled:opacity-40"
        >
          Done
        </button>
      </div>

      {panel === 'tag' && !busy && (
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-500">Add tag to {selectedCount} tune{selectedCount !== 1 ? 's' : ''}:</span>
          <TagInput
            value={tagValue}
            onInput={setTagValue}
            onSubmit={submitTag}
            onCancel={closePanel}
            suggestions={getKnownTags()}
          />
          <button
            onClick={() => submitTag(tagValue)}
            disabled={!tagValue.trim()}
            class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
          >
            Add
          </button>
          <button onClick={closePanel} class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
            cancel
          </button>
        </div>
      )}

      {panel === 'learn' && !busy && (
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-gray-500">Start learning {selectedCount} tune{selectedCount !== 1 ? 's' : ''} on:</span>
          {instruments.map(inst => (
            <button
              key={inst}
              onClick={() => submitInstrument(inst)}
              class="text-xs px-2 py-1 rounded border border-blue-300 bg-white text-blue-600 hover:bg-blue-600 hover:text-white cursor-pointer capitalize"
            >
              {inst}
            </button>
          ))}
          <input
            type="text"
            value={customInstrument}
            onInput={e => setCustomInstrument(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitInstrument(customInstrument)}
            placeholder="Other..."
            class="text-xs border border-gray-300 rounded px-2 py-1 w-24"
          />
          {customInstrument.trim() && (
            <button
              onClick={() => submitInstrument(customInstrument)}
              class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
            >
              Add
            </button>
          )}
          <button onClick={closePanel} class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
            cancel
          </button>
        </div>
      )}

      {panel === 'delete' && (
        <>
          <div class="fixed inset-0 bg-black/40 z-30" onClick={closePanel} />
          <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
              <h3 class="text-base font-semibold text-gray-900">
                Delete {selectedCount} tune{selectedCount !== 1 ? 's' : ''}?
              </h3>
              <p class="text-sm text-gray-600">
                These tunes and all their practice history will be permanently removed from your collection.
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  onClick={closePanel}
                  class="text-sm px-3 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { closePanel(); onDelete(); }}
                  class="text-sm px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
