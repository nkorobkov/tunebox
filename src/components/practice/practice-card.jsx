import { useState, useEffect, useMemo } from 'preact/hooks';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';
import { SheetMusicViewer } from '../tune/sheet-music-viewer';
import { Metronome } from './metronome';
import { TrackPlayer } from './track-player';
import { FluencyRater } from './fluency-rater';
import { BackingTrackPlayer } from './backing-track-player';
import { BackingPanel } from './backing-panel';
import { useTuneChords } from '../../hooks/use-tune-chords';
import { injectChordSymbols } from '../../lib/backing/abc-bars';
import { barSlots, NO_CHORD } from '../../lib/backing/chords';
import { PracticeHistoryChart } from './practice-history-chart';
import { useAttachments, isAudio } from '../../hooks/use-attachments';
import { parseYouTube } from '../../lib/youtube';
import { usePracticeHistory } from '../../hooks/use-practice-history';
import { NotesContent } from '../tune/tune-notes';
import { buildAbcString, getDefaultTempo, getMeter } from '../../lib/abc-utils';
import { daysSince, getInstrumentData, instrumentProficiency, suggestLearningTempo } from '../../lib/practice-algorithm';

export function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return seconds;
}

export function fmtElapsed(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Active practice view for one tune. The card owns a single shared `tempo`:
 * metronome, backing-track rate, the sheet-music MIDI player and the
 * progress button all follow it. Mount with key={tune.id} so per-tune state
 * (tempo, timer, spoilers) resets between tunes.
 */
export function PracticeCard({ tune, instrument, onCompleteLearning, onStruggleLearning, onCompletePlaying, onSkip }) {
  const [saving, setSaving] = useState(false);
  const { mainSource, backingTracks, sources } = useAttachments(tune.id);
  const history = usePracticeHistory(tune.id, instrument);
  const elapsed = useElapsedSeconds();

  const isLearning = instrumentProficiency(tune, instrument) === 'learning';
  const fallbackTempo = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallbackTempo);
  const { suggestion, isFirstTime } = suggestLearningTempo(instData.current_tempo, instData.target_tempo);

  const [tempo, setTempo] = useState(isLearning ? suggestion : instData.target_tempo);
  const [transpose, setTranspose] = useState(tune.transpose || 0);

  const fullAbc = useMemo(() => (tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null), [tune.abc, tune.title, tune.type, tune.setting_key]);
  const chordState = useTuneChords(tune, fullAbc);
  const [showBacking, setShowBacking] = useState(false);
  // Once chords are saved or being worked on, the sheet music shows them too.
  const showChords = showBacking || chordState.source === 'saved';
  const sheetAbc = useChordedAbc(fullAbc, chordState, showChords);
  const meetsTarget = tempo >= instData.target_tempo;

  const withSaving = (fn) => async (...args) => {
    setSaving(true);
    try {
      await fn(...args);
    } catch (err) {
      console.error('Failed to save practice:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = withSaving(() => onCompleteLearning(tune, tempo, elapsed));
  const handleStruggle = withSaving(() => onStruggleLearning(tune, elapsed));
  const handleRate = withSaving((rating) => onCompletePlaying(tune, rating, tempo, elapsed));

  const hint = isLearning
    ? (isFirstTime
      ? `First time on ${instrument} — start where it feels comfortable`
      : `Last time ${instData.current_tempo} BPM — try ${suggestion} today`)
    : `You know this one — play it at ${instData.target_tempo} BPM`;

  // The play tile plays the tune's source recording — first source
  // attachment that is an audio file or a YouTube link.
  const sourceTrack = sources.find(a => (a.file && isAudio(a.file)) || (a.url && parseYouTube(a.url)));

  return (
    <div class="space-y-4">
      {/* Header + timer */}
      <div class="flex items-start justify-between gap-3">
        <TuneHeader tune={tune} instrument={instrument} targetTempo={instData.target_tempo} />
        <span
          class="text-sm text-gray-400 shrink-0 mt-1"
          style="font-variant-numeric: tabular-nums"
          title="Time on this tune"
        >{fmtElapsed(elapsed)}</span>
      </div>

      {/* Tempo + metronome */}
      <div class="space-y-1.5">
        <p class="text-sm text-gray-500">{hint}</p>
        <Metronome
          tempo={tempo}
          onTempoChange={setTempo}
          targetTempo={instData.target_tempo}
          defaultTimeSignature={getMeter(tune.type)}
          extraButton={fullAbc && (
            <BackingToggle open={showBacking} onClick={() => setShowBacking(!showBacking)} />
          )}
        />
        {showBacking && fullAbc && (
          <BackingPanel tune={tune} abc={fullAbc} tempo={tempo} transpose={transpose} chordState={chordState} />
        )}
      </div>

      {/* Playback tools */}
      {sourceTrack && <TrackPlayer key={sourceTrack.id} attachment={sourceTrack} />}
      {backingTracks.length > 0 && (
        <div class="space-y-2">
          {backingTracks.map(bt => <BackingTrackPlayer key={bt.id} attachment={bt} targetTempo={tempo} />)}
        </div>
      )}

      {/* Progress */}
      {isLearning ? (
        <div class="space-y-1">
          <button
            onClick={handleComplete}
            disabled={saving || !tempo}
            class="w-full py-4 rounded-lg text-white font-semibold cursor-pointer disabled:opacity-50 bg-brand-600 hover:bg-brand-700"
          >
            {meetsTarget
              ? `Practiced at ${tempo} BPM — move to Playing!`
              : `Played it cleanly at ${tempo} BPM`}
          </button>
          <div class="flex items-center justify-center gap-6 py-1.5">
            <button
              onClick={handleStruggle}
              disabled={saving}
              class="text-sm text-amber-700 hover:text-amber-800 cursor-pointer disabled:opacity-50"
            >
              Couldn't play it yet
            </button>
            <button onClick={onSkip} class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
              Skip for today
            </button>
          </div>
        </div>
      ) : (
        <div class="space-y-1">
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <FluencyRater
              onRate={handleRate}
              disabled={saving}
              stability={instData.stability}
              elapsedDays={daysSince(instData.last_practiced)}
            />
          </div>
          <div class="text-center py-1.5">
            <button onClick={onSkip} class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
              Skip for today
            </button>
          </div>
        </div>
      )}

      <PracticeSpoilers
        tune={tune}
        mainSource={mainSource}
        fullAbc={fullAbc}
        viewAbc={sheetAbc}
        tempo={tempo}
        transpose={transpose}
        onTransposeChange={setTranspose}
      />

      <PracticeHistoryChart entries={history} targetTempo={instData.target_tempo} />
    </div>
  );
}

function useChordedAbc(abc, { model, chords }, enabled) {
  return useMemo(() => {
    if (!enabled || !abc || !model || !chords) return abc;
    const half = model.barLength / 2;
    return injectChordSymbols(abc, (i) => {
      const slots = barSlots(chords[i]);
      return slots.map((name, h) => ({ name: name === NO_CHORD ? 'N.C.' : name, off: h * half }));
    });
  }, [abc, model, chords, enabled]);
}

function BackingIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function BackingToggle({ open, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      title="Generated backing track"
      class={`flex items-center gap-1.5 px-3 py-2.5 rounded-md text-sm font-medium border cursor-pointer ${
        open ? 'bg-brand-50 border-brand-600 text-brand-800 dark:text-brand-400' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
      }`}
    >
      <BackingIcon class="w-4 h-4" />
      Backing
    </button>
  );
}

function TuneHeader({ tune, instrument, targetTempo }) {
  return (
    <div>
      <h2 class="text-xl font-bold text-gray-900">
        <a href={`/tune/${tune.id}`} class="hover:text-blue-600 no-underline text-gray-900">{tune.title}</a>
      </h2>
      <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
        {tune.type && <span class="capitalize">{tune.type}</span>}
        {tune.setting_key && <span>Key: {tune.setting_key}</span>}
        <span class="text-gray-400">{instrument}</span>
        {targetTempo > 0 && <span class="text-gray-400">Target: {targetTempo} BPM</span>}
      </div>
    </div>
  );
}

export function SheetMusic({ mainSource, fullAbc, viewAbc, tempo, transpose, onTransposeChange }) {
  if (mainSource) {
    return (
      <div class="bg-white lg:rounded-lg lg:border lg:border-gray-200 lg:p-4">
        <SheetMusicViewer attachment={mainSource} />
        {fullAbc && (
          <div class="mt-3">
            <AbcPlayer abc={fullAbc} defaultTempo={tempo} transpose={transpose} />
          </div>
        )}
      </div>
    );
  }
  if (fullAbc) {
    return (
      <div class="bg-white lg:rounded-lg lg:border lg:border-gray-200 lg:p-4 abc-full-bleed">
        <AbcViewer abc={viewAbc || fullAbc} transpose={transpose} onTransposeChange={onTransposeChange} />
        <div class="mt-3">
          <AbcPlayer abc={fullAbc} defaultTempo={tempo} transpose={transpose} />
        </div>
      </div>
    );
  }
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
      No sheet music available for this tune
    </div>
  );
}

export function Spoiler({ label, children }) {
  return (
    <details class="group">
      <summary class="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 list-none flex items-center gap-2 py-2 select-none">
        <span class="inline-block transition-transform group-open:rotate-90">▸</span>
        <span class="group-open:hidden">Show {label}</span>
        <span class="hidden group-open:inline">Hide {label}</span>
      </summary>
      <div class="mt-2">
        {children}
      </div>
    </details>
  );
}

function PracticeSpoilers({ tune, mainSource, fullAbc, viewAbc, tempo, transpose, onTransposeChange }) {
  return (
    <div class="border-t border-gray-200 pt-1">
      <Spoiler label="sheet music">
        <SheetMusic mainSource={mainSource} fullAbc={fullAbc} viewAbc={viewAbc} tempo={tempo} transpose={transpose} onTransposeChange={onTransposeChange} />
      </Spoiler>
      {tune.notes && (
        <Spoiler label="notes">
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <NotesContent notes={tune.notes} />
          </div>
        </Spoiler>
      )}
    </div>
  );
}
