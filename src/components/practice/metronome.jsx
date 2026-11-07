import { useRef, useEffect } from 'preact/hooks';
import { useMetronome } from '../../hooks/use-metronome';
import { claimPlayback, releasePlayback } from '../../lib/exclusive-playback';

export const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'];
const MIN_BPM = 20;

export function MetronomeIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 3h6l3.5 18h-13L9 3z" />
      <path d="M12 16.5 17 7" />
      <circle cx="17.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * The metronome as a practice sound source: starting it stops the generated
 * backing (and vice versa) through exclusive-playback.
 */
export function useMetronomePlayer(tempo, defaultTimeSignature = '4/4') {
  const { timeSignature, playing, start, stop, updateTimeSignature } = useMetronome(tempo, defaultTimeSignature);
  const token = useRef({ stop: () => {} });
  token.current.stop = stop;
  useEffect(() => () => releasePlayback(token.current), []);
  return {
    timeSignature,
    setTimeSignature: updateTimeSignature,
    playing,
    play: () => { claimPlayback(token.current); start(); },
    stop: () => { stop(); releasePlayback(token.current); },
  };
}

/**
 * Shared practice tempo: readout, steppers and a slider with a target tick.
 * `tempo` is owned by the card; metronome, backing, tune playback and
 * backing-track rate all follow it.
 */
export function TempoControl({ tempo, onTempoChange, targetTempo = 0 }) {
  const max = Math.max(180, targetTempo + 20);
  const adjust = (delta) => onTempoChange(Math.max(MIN_BPM, Math.min(max, tempo + delta)));
  const atTarget = targetTempo > 0 && tempo >= targetTempo;

  const stepBtnClass = 'h-10 w-10 flex items-center justify-center border border-gray-300 rounded-md text-sm font-mono bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer shrink-0';
  const targetPct = targetTempo > 0 ? ((targetTempo - MIN_BPM) / (max - MIN_BPM)) * 100 : null;

  return (
    <>
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
    </>
  );
}
