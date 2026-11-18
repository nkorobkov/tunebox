import { useState, useEffect } from 'preact/hooks';
import { TempoControl, useMetronomePlayer, MetronomeIcon, TIME_SIGNATURES } from './metronome';
import { BackingOptions } from './backing';
import { PlayIcon, StopIcon } from './tool-tile';
import { LoopIcon, LoopPicker, ProgressTrack } from './tune-player';

const MODE_KEY = 'tunebox.practiceSound';
const MODES = [{ id: 'backing', label: 'Backing' }, { id: 'metronome', label: 'Metronome' }, { id: 'loop', label: 'Loop' }];

function loadMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return MODES.some(x => x.id === m) ? m : 'backing';
  } catch { return 'backing'; }
}

/** The chosen practice sound ('backing' | 'metronome' | 'loop'), remembered per device. */
export function usePracticeSoundMode() {
  const [mode, setMode] = useState(loadMode);
  const choose = (m) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ }
  };
  return [mode, choose];
}

function GearIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * Tempo plus one play button for what the user practises over — the
 * generated backing, the metronome, or the tune's melody on a loop
 * (`tunePlayer`, from useTunePlayer) — and a gear that opens their settings
 * (mode, time signature, sound, chords, the bars to loop). `mode`/`onModeChange`
 * come from usePracticeSoundMode (the card owns them, so the backing only
 * arranges while it's the chosen mode). `backing` (from useBacking) is optional; without it,
 * or when the tune has no notation, only the metronome is offered.
 * `onBackingShown(bool)` reports when the backing is in use, so the sheet
 * music can show its chords.
 */
export function PracticeSound({ tempo, onTempoChange, targetTempo, defaultTimeSignature, backing = null, tunePlayer = null, mode: savedMode = 'metronome', onModeChange, onBackingShown }) {
  const metronome = useMetronomePlayer(tempo, defaultTimeSignature);
  const [open, setOpen] = useState(false);
  const canBack = !!backing?.available;
  const canLoop = !!tunePlayer?.available;
  const modes = MODES.filter(m => (m.id === 'backing' ? canBack : m.id === 'loop' ? canLoop : true));
  const mode = modes.some(m => m.id === savedMode) ? savedMode : 'metronome';

  // the generated backing and the loop are both rendered players
  const rendered = mode === 'backing' ? backing : mode === 'loop' ? tunePlayer : null;
  const renderedStatus = rendered?.status || 'idle';
  const playing = rendered ? renderedStatus !== 'idle' : metronome.playing;

  const backingShown = mode === 'backing' && (open || renderedStatus !== 'idle');
  useEffect(() => { onBackingShown?.(backingShown); }, [backingShown]);

  const chooseMode = (m) => {
    if (m === mode) return;
    if (rendered) rendered.stop(); else metronome.stop();
    onModeChange?.(m);
  };

  const toggle = () => {
    if (rendered) {
      if (renderedStatus === 'idle') rendered.play(); else rendered.stop();
    } else if (metronome.playing) {
      metronome.stop();
    } else {
      metronome.play();
    }
  };

  // Loop mode with no bars picked plays (and repeats) the whole tune
  const noun = mode === 'loop' ? (tunePlayer.selection ? 'loop' : 'tune') : 'backing';
  const label = rendered
    ? (renderedStatus === 'loading' ? 'Preparing…' : renderedStatus === 'playing' ? `Stop ${noun}` : `Play ${noun}`)
    : (metronome.playing ? 'Stop metronome' : 'Start metronome');
  const icon = playing
    ? <StopIcon class="w-4 h-4" />
    : <ModeIcon mode={mode} class="w-4 h-4" />;

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-2.5">
      <TempoControl tempo={tempo} onTempoChange={onTempoChange} targetTempo={targetTempo} />
      <div class="flex items-center gap-2">
        <button
          onClick={toggle}
          disabled={!!rendered && !rendered.ready && renderedStatus === 'idle'}
          class={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer text-white disabled:opacity-50 ${
            playing ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {icon}
          {label}
        </button>
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${MODES.find(m => m.id === mode).label} settings`}
          title="Settings"
          class={`shrink-0 h-10 w-10 flex items-center justify-center rounded-md border cursor-pointer ${
            open ? 'bg-brand-50 border-brand-600 text-brand-800 dark:text-brand-400' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          <GearIcon class="w-4 h-4" />
        </button>
      </div>
      {rendered?.playError && <p class="text-xs text-red-600">{rendered.playError}</p>}
      {mode === 'loop' && (
        <div class="space-y-1">
          <div class="flex"><ProgressTrack player={tunePlayer} /></div>
          {tunePlayer.selection && (
            <p class="text-xs text-gray-500">
              Looping {tunePlayer.loopName} ·{' '}
              <button onClick={tunePlayer.clearLoop} class="text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer">Clear loop</button>
            </p>
          )}
        </div>
      )}

      {open && (
        <div class="border-t border-gray-100 pt-3 space-y-3">
          {modes.length > 1 && <ModeSwitch modes={modes} value={mode} onChange={chooseMode} />}
          {mode === 'loop' ? (
            <LoopPicker player={tunePlayer} />
          ) : mode === 'metronome' ? (
            <label class="flex items-center justify-between gap-3 text-sm text-gray-700">
              Time signature
              <select
                value={metronome.timeSignature}
                onChange={e => metronome.setTimeSignature(e.target.value)}
                class="text-sm font-mono border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                {TIME_SIGNATURES.map(ts => <option key={ts} value={ts}>{ts}</option>)}
              </select>
            </label>
          ) : (
            <BackingOptions backing={backing} />
          )}
        </div>
      )}
    </div>
  );
}

function ModeIcon({ mode, class: cls }) {
  if (mode === 'loop') return <LoopIcon class={cls} />;
  if (mode === 'backing') return <PlayIcon class={cls} />;
  return <MetronomeIcon class={cls} />;
}

// iOS-style segmented control: a grey track with the chosen mode raised as a
// white pill — deliberately unlike the green option chips in the settings.
// On phones only the chosen mode keeps its label, so three fit.
function ModeSwitch({ modes, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Play along with" class="flex p-1 rounded-lg bg-gray-100">
      {modes.map(m => {
        const on = value === m.id;
        return (
          <button
            key={m.id}
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            title={m.label}
            onClick={() => onChange(m.id)}
            class={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium cursor-pointer ${
              on ? 'flex-[2] sm:flex-1 bg-white text-gray-900 shadow-sm' : 'flex-1 text-gray-500 hover:text-gray-700'
            }`}
          >
            <ModeIcon mode={m.id} class="w-3.5 h-3.5 shrink-0" />
            <span class={on ? '' : 'hidden sm:inline'}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
