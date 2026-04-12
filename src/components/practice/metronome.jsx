import { useMetronome } from '../../hooks/use-metronome';

export function Metronome({ defaultBpm = 120, onTempoChange }) {
  const { bpm, playing, start, stop, updateBpm } = useMetronome(defaultBpm);

  const handleBpmChange = (newBpm) => {
    updateBpm(newBpm);
    if (onTempoChange) onTempoChange(newBpm);
  };

  return (
    <div class="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <button
        onClick={playing ? stop : start}
        class={`px-4 py-2 rounded-md text-sm font-medium cursor-pointer touch-manipulation ${
          playing
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-gray-800 text-white hover:bg-gray-900'
        }`}
      >
        {playing ? 'Stop' : 'Metronome'}
      </button>

      <div class="flex items-center gap-2">
        <button
          onClick={() => handleBpmChange(Math.max(20, bpm - 5))}
          class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-gray-100 cursor-pointer shrink-0"
        >
          -
        </button>
        <input
          type="range"
          min={20}
          max={280}
          value={bpm}
          onInput={e => handleBpmChange(Number(e.target.value))}
          class="flex-1 min-w-0 lg:w-32"
        />
        <button
          onClick={() => handleBpmChange(Math.min(280, bpm + 5))}
          class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-gray-100 cursor-pointer shrink-0"
        >
          +
        </button>
        <span class="text-sm font-mono text-gray-700 w-14 text-center shrink-0">{bpm} bpm</span>
      </div>
    </div>
  );
}
