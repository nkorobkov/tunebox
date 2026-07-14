import { useState, useRef, useEffect } from 'preact/hooks';
import { useMetronome } from '../../hooks/use-metronome';

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'];
const MIN_BPM = 20;

function MetronomeIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 3h6l3.5 18h-13L9 3z" />
      <path d="M12 16.5 17 7" />
      <circle cx="17.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The metronome panel: shared practice tempo (readout, steppers, slider with
 * a target tick), the metronome start/stop button, and the time-signature
 * picker — everything metronome-related in one place. `tempo` is owned by
 * the card; tune playback and backing-track rate follow the same value.
 */
export function Metronome({ tempo, onTempoChange, targetTempo = 0, defaultTimeSignature = '4/4' }) {
  const { timeSignature, playing, start, stop, updateTimeSignature } = useMetronome(tempo, defaultTimeSignature);
  const [showTsPicker, setShowTsPicker] = useState(false);
  const pickerRef = useRef(null);

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

  const max = Math.max(180, targetTempo + 20);
  const adjust = (delta) => onTempoChange(Math.max(MIN_BPM, Math.min(max, tempo + delta)));
  const atTarget = targetTempo > 0 && tempo >= targetTempo;

  const stepBtnClass = 'h-10 w-10 flex items-center justify-center border border-gray-300 rounded-md text-sm font-mono bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer shrink-0';
  const targetPct = targetTempo > 0 ? ((targetTempo - MIN_BPM) / (max - MIN_BPM)) * 100 : null;

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <button onClick={() => adjust(-5)} aria-label="Decrease BPM by 5" class={stepBtnClass}>−5</button>
          <button onClick={() => adjust(-1)} aria-label="Decrease BPM by 1" class={stepBtnClass}>−</button>
        </div>
        <div class="text-center leading-none">
          <span class={`text-3xl font-semibold ${atTarget ? 'text-brand-700 dark:text-brand-400' : 'text-gray-900'}`}>{tempo}</span>
          <span class="block text-[11px] text-gray-400 mt-1 uppercase tracking-wide">bpm</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button onClick={() => adjust(1)} aria-label="Increase BPM by 1" class={stepBtnClass}>+</button>
          <button onClick={() => adjust(5)} aria-label="Increase BPM by 5" class={stepBtnClass}>+5</button>
        </div>
      </div>
      <div class="relative">
        {targetPct !== null && (
          <div
            class="absolute -top-0.5 w-0.5 h-2 bg-gray-400 rounded pointer-events-none"
            style={{ left: `${targetPct}%` }}
            title={`Target: ${targetTempo} BPM`}
          />
        )}
        <input
          type="range"
          min={MIN_BPM}
          max={max}
          value={tempo}
          aria-label="Practice tempo"
          onInput={e => onTempoChange(Number(e.target.value))}
          class="w-full block"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          onClick={playing ? stop : start}
          class={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer text-white ${
            playing
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          <MetronomeIcon class="w-4 h-4" />
          {playing ? 'Stop metronome' : 'Start metronome'}
        </button>
        <div class="relative" ref={pickerRef}>
          <button
            onClick={() => setShowTsPicker(!showTsPicker)}
            title="Time signature"
            class="px-3 py-2.5 rounded-md text-sm font-mono font-medium border border-gray-300 bg-white hover:bg-gray-100 cursor-pointer"
          >
            {timeSignature}
          </button>
          {showTsPicker && (
            <div class="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
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
    </div>
  );
}
