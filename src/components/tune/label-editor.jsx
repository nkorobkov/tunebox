import { useState } from 'preact/hooks';

export function LabelEditor({ labels = [], onUpdate, setLabel, addingSet, onStartAddSet, onCancelAddSet, newSetName, onSetNameInput, onAddSet }) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const tags = labels.filter(l => l.type === 'tag');

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    const updated = [...labels, { type: 'tag', value: newValue.trim() }];
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
            class="ml-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
          >
            &times;
          </button>
        </span>
      ))}

      {adding ? (
        <div class="flex items-center gap-1.5">
          <input
            type="text"
            value={newValue}
            onInput={e => setNewValue(e.target.value)}
            placeholder="Tag..."
            class="text-xs border border-gray-300 rounded px-2 py-1 w-28"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autofocus
          />
          <button
            onClick={handleAdd}
            disabled={!newValue.trim()}
            class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
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
          class="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer"
        >
          + Add tag
        </button>
      )}

      {!setLabel && onStartAddSet && (
        addingSet ? (
          <div class="flex items-center gap-1.5">
            <input
              type="text"
              value={newSetName}
              onInput={e => onSetNameInput(e.target.value)}
              placeholder="Set name..."
              class="text-xs border border-gray-300 rounded px-2 py-1 w-28"
              onKeyDown={e => e.key === 'Enter' && onAddSet()}
              autofocus
            />
            <button onClick={onAddSet} disabled={!newSetName?.trim()} class="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer">Add</button>
            <button onClick={onCancelAddSet} class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
          </div>
        ) : (
          <button
            onClick={onStartAddSet}
            class="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer"
          >
            + Add to set
          </button>
        )
      )}
    </div>
  );
}
