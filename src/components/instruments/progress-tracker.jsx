import { useState } from 'preact/hooks';

const COMFORT_LEVELS = ['learning', 'shaky', 'solid', 'performance'];

export function InstrumentProgress({ instruments, userInstruments, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newInstrument, setNewInstrument] = useState('');

  const handleAdd = async () => {
    const name = newInstrument.trim();
    if (!name || instruments[name]) return;
    const updated = { ...instruments, [name]: { keys: [], current_tempo: 0, target_tempo: 0, comfort: 'learning' } };
    await onUpdate(updated);
    setNewInstrument('');
    setAdding(false);
  };

  const handleRemove = async (name) => {
    const updated = { ...instruments };
    delete updated[name];
    await onUpdate(updated);
  };

  const handleFieldChange = async (name, field, value) => {
    const updated = {
      ...instruments,
      [name]: { ...instruments[name], [field]: value },
    };
    await onUpdate(updated);
  };

  const handleKeysChange = async (name, keysStr) => {
    const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean);
    await handleFieldChange(name, 'keys', keys);
  };

  // Instruments from user profile not yet added to this tune
  const availableInstruments = userInstruments.filter(i => !instruments[i]);

  return (
    <div class="space-y-3">
      {Object.entries(instruments).map(([name, data]) => (
        <div key={name} class="flex items-center gap-3 text-sm flex-wrap">
          <span class="font-medium text-gray-800 w-24 shrink-0">{name}</span>
          <input
            type="text"
            value={(data.keys || []).join(', ')}
            onChange={e => handleKeysChange(name, e.target.value)}
            placeholder="Keys (e.g. D, G)"
            class="w-28 px-2 py-1 border border-gray-300 rounded text-xs"
          />
          <div class="flex items-center gap-1">
            <input
              type="number"
              value={data.current_tempo || ''}
              onChange={e => handleFieldChange(name, 'current_tempo', Number(e.target.value))}
              placeholder="BPM"
              class="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
            />
            <span class="text-gray-400 text-xs">/</span>
            <input
              type="number"
              value={data.target_tempo || ''}
              onChange={e => handleFieldChange(name, 'target_tempo', Number(e.target.value))}
              placeholder="Target"
              class="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
          <select
            value={data.comfort || 'learning'}
            onChange={e => handleFieldChange(name, 'comfort', e.target.value)}
            class={`text-xs px-2 py-1 rounded-full border-0 ${
              data.comfort === 'performance' ? 'bg-green-100 text-green-700' :
              data.comfort === 'solid' ? 'bg-blue-100 text-blue-700' :
              data.comfort === 'shaky' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}
          >
            {COMFORT_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => handleRemove(name)}
            class="text-gray-400 hover:text-red-500 text-xs cursor-pointer"
          >
            remove
          </button>
        </div>
      ))}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          class="text-xs px-2 py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer"
        >
          + Add instrument
        </button>
      ) : (
        <div class="flex items-center gap-2">
          {availableInstruments.length > 0 ? (
            <select
              value={newInstrument}
              onChange={e => setNewInstrument(e.target.value)}
              class="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">Select...</option>
              {availableInstruments.map(i => <option key={i} value={i}>{i}</option>)}
              <option value="__custom">Other...</option>
            </select>
          ) : null}
          {(availableInstruments.length === 0 || newInstrument === '__custom') && (
            <input
              type="text"
              value={newInstrument === '__custom' ? '' : newInstrument}
              onInput={e => setNewInstrument(e.target.value)}
              placeholder="Instrument name..."
              class="text-sm border border-gray-300 rounded px-2 py-1"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          )}
          <button onClick={handleAdd} disabled={!newInstrument.trim() || newInstrument === '__custom'} class="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer">Add</button>
          <button onClick={() => { setAdding(false); setNewInstrument(''); }} class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">Cancel</button>
        </div>
      )}
    </div>
  );
}
