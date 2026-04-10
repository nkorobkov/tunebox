import { useState } from 'preact/hooks';

const CATEGORY_PRESETS = ['want to learn', 'learning', 'playing', 'retired'];

export function LabelEditor({ labels = [], onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState('category');
  const [newValue, setNewValue] = useState('');

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    const updated = [...labels, { type: newType, value: newValue.trim() }];
    await onUpdate(updated);
    setNewValue('');
    setAdding(false);
  };

  const handleRemove = async (index) => {
    const updated = labels.filter((_, i) => i !== index);
    await onUpdate(updated);
  };

  return (
    <div class="space-y-2">
      <div class="flex flex-wrap gap-2">
        {labels.map((label, i) => (
          <span
            key={i}
            class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
          >
            <span class="text-gray-400">{label.type}:</span> {label.value}
            <button
              onClick={() => handleRemove(i)}
              class="ml-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
            >
              x
            </button>
          </span>
        ))}
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            class="text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer"
          >
            + Add label
          </button>
        )}
      </div>

      {adding && (
        <div class="flex items-center gap-2">
          <select
            value={newType}
            onChange={e => {
              setNewType(e.target.value);
              setNewValue('');
            }}
            class="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="category">Category</option>
            <option value="session">Session</option>
            <option value="set">Set</option>
            <option value="tag">Tag</option>
          </select>

          {newType === 'category' ? (
            <select
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              class="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Select...</option>
              {CATEGORY_PRESETS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={newValue}
              onInput={e => setNewValue(e.target.value)}
              placeholder={newType === 'set' ? 'Set name...' : newType === 'session' ? 'Session name...' : 'Tag...'}
              class="text-sm border border-gray-300 rounded px-2 py-1 flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          )}

          <button
            onClick={handleAdd}
            disabled={!newValue.trim()}
            class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            Add
          </button>
          <button
            onClick={() => { setAdding(false); setNewValue(''); }}
            class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
