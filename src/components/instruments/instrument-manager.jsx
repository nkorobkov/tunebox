import { useState } from 'preact/hooks';

export function InstrumentManager({ instruments = [], onUpdate, defaultInstrument, onSetDefault }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name || instruments.includes(name)) return;
    await onUpdate([...instruments, name]);
    setNewName('');
    setAdding(false);
  };

  const [confirmRemove, setConfirmRemove] = useState(null);

  const handleRemove = async (name) => {
    setConfirmRemove(null);
    await onUpdate(instruments.filter(i => i !== name), name);
  };

  return (
    <div class="space-y-3">
      {instruments.length === 0 && !adding && (
        <p class="text-sm text-gray-400">No instruments added yet.</p>
      )}
      {instruments.map(name => {
        const isDefault = defaultInstrument === name;
        return (
          <div
            key={name}
            class={`flex items-center justify-between py-2 px-3 rounded border ${
              isDefault ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-800">{name}</span>
              {isDefault && <span class="text-xs text-blue-500 font-medium">Default</span>}
            </div>
            <div class="flex items-center gap-3">
              {onSetDefault && !isDefault && (
                <button
                  onClick={() => onSetDefault(name)}
                  class="text-xs cursor-pointer text-gray-400 hover:text-blue-500"
                >
                  set as default
                </button>
              )}
              <button
                onClick={() => setConfirmRemove(name)}
                class="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}

      {confirmRemove && (
        <>
          <div class="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmRemove(null)} />
          <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
              <h3 class="text-base font-semibold text-gray-900">Remove {confirmRemove}?</h3>
              <p class="text-sm text-gray-600">
                All your tune learning progress with <strong>{confirmRemove}</strong> will be lost. Are you sure you want to remove it?
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmRemove(null)}
                  class="text-sm px-3 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemove(confirmRemove)}
                  class="text-sm px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
