import { useState } from 'preact/hooks';
import { TagInput } from './tag-input';
import { getKnownTags, addKnownTag, getKnownSets, addKnownSet } from '../../lib/tag-store';
import { useConnectivity } from '../../lib/connectivity';

export function LabelEditor({ labels = [], onUpdate, setLabel, addingSet, onStartAddSet, onCancelAddSet, newSetName, onSetNameInput, onAddSet }) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const { isOffline } = useConnectivity();
  const offlineTitle = isOffline ? 'Unavailable offline' : undefined;

  const tags = labels.filter(l => l.type === 'tag');

  const handleAdd = async (val) => {
    const v = (typeof val === 'string' ? val : newValue).trim();
    if (!v) return;
    addKnownTag(v);
    const updated = [...labels, { type: 'tag', value: v }];
    await onUpdate(updated);
    setNewValue('');
    setAdding(false);
  };

  const handleRemove = async (tag) => {
    const idx = labels.indexOf(tag);
    const updated = labels.filter((_, i) => i !== idx);
    await onUpdate(updated);
  };

  return (
    <div class="flex flex-wrap items-center gap-2">
      {tags.map((tag, i) => (
        <span
          key={i}
          class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
        >
          {tag.value}
          <button
            onClick={() => handleRemove(tag)}
            disabled={isOffline}
            title={offlineTitle}
            class="ml-0.5 text-gray-400 hover:text-red-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &times;
          </button>
        </span>
      ))}

      {adding ? (
        <div class="flex items-center gap-1.5">
          <TagInput
            value={newValue}
            onInput={setNewValue}
            onSubmit={handleAdd}
            onCancel={() => { setAdding(false); setNewValue(''); }}
            suggestions={getKnownTags().filter(t => !tags.some(x => x.value === t))}
          />
          <button
            onClick={() => handleAdd()}
            disabled={!newValue.trim()}
            class="text-xs px-2 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 cursor-pointer"
          >
            Add
          </button>
          <button
            onClick={() => { setAdding(false); setNewValue(''); }}
            class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={isOffline}
          title={offlineTitle}
          class="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add tag
        </button>
      )}

      {!setLabel && onStartAddSet && (
        addingSet ? (
          <div class="flex items-center gap-1.5">
            <TagInput
              value={newSetName}
              onInput={onSetNameInput}
              onSubmit={onAddSet}
              onCancel={onCancelAddSet}
              suggestions={getKnownSets()}
            />
            <button onClick={onAddSet} disabled={!newSetName?.trim()} class="text-xs px-2 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50 cursor-pointer">Add</button>
            <button onClick={onCancelAddSet} class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
          </div>
        ) : (
          <button
            onClick={onStartAddSet}
            disabled={isOffline}
            title={offlineTitle}
            class="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add to set
          </button>
        )
      )}
    </div>
  );
}
