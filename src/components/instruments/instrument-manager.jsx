import { useState } from 'preact/hooks';
import { Button } from '../common/button';
import { ConfirmDialog } from '../common/dialog';

export function InstrumentManager({ instruments = [], onUpdate, defaultInstrument, onSetDefault, disabled = false }) {
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
              isDefault ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-800">{name}</span>
              {isDefault && <span class="text-xs text-brand-600 font-medium">Default</span>}
            </div>
            <div class="flex items-center gap-3">
              {onSetDefault && !isDefault && (
                <button
                  onClick={() => onSetDefault(name)}
                  class="text-xs cursor-pointer text-gray-400 hover:text-blue-600"
                >
                  set as default
                </button>
              )}
              <button
                onClick={() => setConfirmRemove(name)}
                disabled={disabled}
                title={disabled ? 'Unavailable offline' : undefined}
                class="text-xs text-gray-400 hover:text-red-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}

      {confirmRemove && (
        <ConfirmDialog
          title={`Remove ${confirmRemove}?`}
          message={<>All your tune learning progress with <strong>{confirmRemove}</strong> will be lost. Are you sure you want to remove it?</>}
          confirmLabel="Remove"
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
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
          <Button size="md" onClick={handleAdd} disabled={!newName.trim()}>Add</Button>
          <button onClick={() => { setAdding(false); setNewName(''); }} class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={disabled}
          title={disabled ? 'Unavailable offline' : undefined}
          class="text-sm px-3 py-2 border border-dashed border-gray-300 rounded text-gray-400 hover:text-gray-600 hover:border-gray-400 w-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add instrument
        </button>
      )}
    </div>
  );
}
