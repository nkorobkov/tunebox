import { useState } from 'preact/hooks';

export function InstrumentManager({ instruments = [], onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || instruments.includes(name)) return;
    await onUpdate([...instruments, name]);
    setNewName('');
    setAdding(false);
  };

  const handleRemove = async (name) => {
    await onUpdate(instruments.filter(i => i !== name));
  };

  return (
    <div class="space-y-3">
      {instruments.length === 0 && !adding && (
        <p class="text-sm text-gray-400">No instruments added yet.</p>
      )}
      {instruments.map(name => (
        <div key={name} class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
          <span class="text-sm font-medium text-gray-800">{name}</span>
          <button
            onClick={() => handleRemove(name)}
            class="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
          >
            Remove
          </button>
        </div>
      ))}

      {adding ? (
        <div class="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onInput={e => setNewName(e.target.value)}
            placeholder="e.g. Fiddle, Tin Whistle, Guitar..."
            class="flex-1 text-sm border border-gray-300 rounded px-3 py-2"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autofocus
          />
          <button onClick={handleAdd} disabled={!newName.trim()} class="text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer">Add</button>
          <button onClick={() => { setAdding(false); setNewName(''); }} class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          class="text-sm px-3 py-2 border border-dashed border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:border-gray-400 w-full cursor-pointer"
        >
          + Add instrument
        </button>
      )}
    </div>
  );
}
