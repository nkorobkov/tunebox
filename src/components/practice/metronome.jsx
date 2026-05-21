import { useState, useRef, useEffect } from 'preact/hooks';
import { useMetronome } from '../../hooks/use-metronome';

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'];

export function Metronome({ defaultBpm = 120, defaultTimeSignature = '4/4', onTempoChange }) {
  const { bpm, timeSignature, playing, start, stop, updateBpm, updateTimeSignature } = useMetronome(defaultBpm, defaultTimeSignature);
  const [showTsPicker, setShowTsPicker] = useState(false);
  const pickerRef = useRef(null);

  const handleBpmChange = (newBpm) => {
    updateBpm(newBpm);
    if (onTempoChange) onTempoChange(newBpm);
  };

  // Close picker on outside click
  useEffect(() => {
    if (!showTsPicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowTsPicker(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showTsPicker]);

  const adjustBpm = (delta) => handleBpmChange(Math.max(20, Math.min(160, bpm + delta)));

  const stepBtnClass = "h-9 px-2 min-w-9 flex items-center justify-center border border-gray-300 rounded text-xs font-mono bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer shrink-0";

  return (
    <div class="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div class="flex items-center gap-2 justify-between lg:justify-start">
        <div class="flex items-center gap-2">
          <button
            onClick={playing ? stop : start}
            class={`px-4 py-2 rounded-md text-sm font-medium cursor-pointer ${
              playing
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-800 text-white hover:bg-gray-900'
            }`}
          >
            {playing ? 'Stop' : 'Metronome'}
          </button>

          {/* Time signature picker */}
          <div class="relative" ref={pickerRef}>
            <button
              onClick={() => setShowTsPicker(!showTsPicker)}
              class="px-3 py-2 rounded-md text-sm font-mono font-medium border border-gray-300 bg-white hover:bg-gray-100 cursor-pointer"
            >
              {timeSignature}
            </button>
            {showTsPicker && (
              <div class="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                {TIME_SIGNATURES.map(ts => (
                  <button
                    key={ts}
                    onClick={() => { updateTimeSignature(ts); setShowTsPicker(false); }}
                    class={`block w-full px-4 py-2 text-sm font-mono text-left cursor-pointer hover:bg-gray-100 ${
                      ts === timeSignature ? 'bg-gray-100 font-bold' : ''
                    }`}
                  >
                    {ts}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span class="text-sm font-mono text-gray-700 shrink-0 lg:hidden">{bpm} bpm</span>
      </div>

      <div class="flex items-center gap-1.5 lg:gap-2">
        <button onClick={() => adjustBpm(-5)} aria-label="Decrease BPM by 5" class={stepBtnClass}>−5</button>
        <button onClick={() => adjustBpm(-1)} aria-label="Decrease BPM by 1" class={stepBtnClass}>−</button>
        <input
          type="range"
          min={20}
          max={160}
          value={bpm}
          onInput={e => handleBpmChange(Number(e.target.value))}
          class="flex-1 min-w-0 lg:w-32"
        />
        <button onClick={() => adjustBpm(1)} aria-label="Increase BPM by 1" class={stepBtnClass}>+</button>
        <button onClick={() => adjustBpm(5)} aria-label="Increase BPM by 5" class={stepBtnClass}>+5</button>
        <span class="hidden lg:inline text-sm font-mono text-gray-700 w-14 text-center shrink-0">{bpm} bpm</span>
      </div>
    </div>
  );
}
