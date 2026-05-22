import { useState } from 'preact/hooks';
import { useConnectivity } from '../../lib/connectivity';

export function InstrumentProgress({ instruments, userInstruments, defaultTargetTempo = 0, onUpdate, onPractice }) {
  const [adding, setAdding] = useState(false);
  const [newInstrument, setNewInstrument] = useState('');
  const { isOffline } = useConnectivity();
  const offlineTitle = isOffline ? 'Unavailable offline' : undefined;

  const handleAdd = async () => {
    const name = newInstrument.trim();
    if (!name || instruments[name]) return;
    const updated = { ...instruments, [name]: { keys: [], current_tempo: 0, target_tempo: defaultTargetTempo || 0 } };
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
      {Object.entries(instruments).map(([name, data]) => {
        const isPlaying = data.current_tempo >= data.target_tempo && data.target_tempo > 0;
        const isLearning = !isPlaying && data.target_tempo > 0;
        return (
          <div key={name} class="flex items-center gap-3 text-sm flex-wrap">
            <span class="font-medium text-gray-800 w-24 shrink-0">{name}</span>
            <div class="flex items-center gap-1">
              <input
                type="number"
                value={data.current_tempo || ''}
                onChange={e => handleFieldChange(name, 'current_tempo', Number(e.target.value))}
                disabled={isOffline}
                title={offlineTitle}
                placeholder="BPM"
                class="w-16 px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span class="text-gray-400 text-xs">/</span>
              <input
                type="number"
                value={data.target_tempo || ''}
                onChange={e => handleFieldChange(name, 'target_tempo', Number(e.target.value))}
                disabled={isOffline}
                title={offlineTitle}
                placeholder="Target"
                class="w-16 px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {isPlaying && (
              <span class="text-xs text-green-600">playing</span>
            )}
            {isLearning && (
              <button
                onClick={() => handleFieldChange(name, 'current_tempo', data.target_tempo)}
                disabled={isOffline}
                title={offlineTitle}
                class="text-xs text-green-600 hover:text-green-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                mark as playing
              </button>
            )}
            {onPractice && (
              <button
                onClick={() => onPractice(name)}
                class="text-blue-600 hover:text-blue-700 text-xs cursor-pointer"
              >
                practice
              </button>
            )}
            <button
              onClick={() => handleRemove(name)}
              disabled={isOffline}
              title={offlineTitle}
              class="text-gray-400 hover:text-red-500 text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              remove
            </button>
          </div>
        );
      })}

      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          disabled={isOffline}
          title={offlineTitle}
          class="text-xs px-2 py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
