import { useState } from 'preact/hooks';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';
import { SheetMusicViewer } from '../tune/sheet-music-viewer';
import { Metronome } from './metronome';
import { FluencyRater } from './fluency-rater';
import { BackingTrackPlayer } from './backing-track-player';
import { useAttachments } from '../../hooks/use-attachments';
import { NotesContent } from '../tune/tune-notes';
import { buildAbcString, getDefaultTempo, getMeter } from '../../lib/abc-utils';
import { getInstrumentData, instrumentProficiency, suggestLearningTempo } from '../../lib/practice-algorithm';

export function PracticeCard({ tune, instrument, onCompleteLearning, onStruggleLearning, onCompletePlaying, onSkip }) {
  const [saving, setSaving] = useState(false);
  const { mainSource, backingTracks } = useAttachments(tune.id);

  const isLearning = instrumentProficiency(tune, instrument) === 'learning';

  const fallbackTempo = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallbackTempo);

  const fullAbc = tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null;

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

  const handleLearningComplete = withSaving((tempo) => onCompleteLearning(tune, tempo));
  const handleLearningStruggle = withSaving(() => onStruggleLearning(tune));
  const handlePlayingRate = withSaving((rating) => onCompletePlaying(tune, rating));

  if (isLearning) {
    return (
      <LearningCard
        tune={tune}
        instrument={instrument}
        instData={instData}
        fullAbc={fullAbc}
        mainSource={mainSource}
        backingTracks={backingTracks}
        saving={saving}
        onComplete={handleLearningComplete}
        onStruggle={handleLearningStruggle}
        onSkip={onSkip}
      />
    );
  }

  return (
    <PlayingCard
      tune={tune}
      instrument={instrument}
      instData={instData}
      fullAbc={fullAbc}
      mainSource={mainSource}
      backingTracks={backingTracks}
      saving={saving}
      onRate={handlePlayingRate}
      onSkip={onSkip}
    />
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

function SheetMusic({ mainSource, fullAbc, transpose, onTransposeChange }) {
  if (mainSource) {
    return (
      <div class="bg-white lg:rounded-lg lg:border lg:border-gray-200 lg:p-4">
        <SheetMusicViewer attachment={mainSource} />
      </div>
    );
  }
  if (fullAbc) {
    return (
      <div class="bg-white lg:rounded-lg lg:border lg:border-gray-200 lg:p-4 abc-full-bleed">
        <AbcViewer abc={fullAbc} transpose={transpose} onTransposeChange={onTransposeChange} />
      </div>
    );
  }
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
      No sheet music available for this tune
    </div>
  );
}

function Spoiler({ label, children }) {
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

function PracticeSpoilers({ tune, mainSource, fullAbc, transpose, onTransposeChange }) {
  return (
    <>
      <Spoiler label="sheet music">
        <SheetMusic mainSource={mainSource} fullAbc={fullAbc} transpose={transpose} onTransposeChange={onTransposeChange} />
      </Spoiler>
      {tune.notes && (
        <Spoiler label="notes">
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <NotesContent notes={tune.notes} />
          </div>
        </Spoiler>
      )}
    </>
  );
}

function LearningCard({ tune, instrument, instData, fullAbc, mainSource, backingTracks, saving, onComplete, onStruggle, onSkip }) {
  const { suggestion, isFirstTime } = suggestLearningTempo(instData.current_tempo, instData.target_tempo);
  const [tempo, setTempo] = useState(suggestion);
  const [transpose, setTranspose] = useState(tune.transpose || 0);
  const meetsTarget = tempo >= instData.target_tempo;

  return (
    <div class="space-y-4">
      <TuneHeader tune={tune} instrument={instrument} targetTempo={instData.target_tempo} />

      {/* Prompt */}
      <div class="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <p class="text-sm text-blue-800 font-medium">
          Practice at the max BPM where you can play reliably.
        </p>
        {isFirstTime ? (
          <p class="text-sm text-blue-600 mt-1">
            First time! Start at whatever tempo feels comfortable.
            Target: {instData.target_tempo} BPM.
          </p>
        ) : (
          <p class="text-sm text-blue-600 mt-1">
            Last time: {instData.current_tempo} BPM. How about {suggestion} BPM today?
          </p>
        )}
      </div>

      {/* Playback + Metronome */}
      <div class="space-y-2">
        {fullAbc && <AbcPlayer abc={fullAbc} defaultTempo={tempo} transpose={transpose} />}
        <Metronome defaultBpm={tempo} defaultTimeSignature={getMeter(tune.type)} onTempoChange={setTempo} />
        {backingTracks.map(bt => <BackingTrackPlayer key={bt.id} attachment={bt} targetTempo={tempo} />)}
      </div>

      {/* Complete button */}
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <button
          onClick={() => onComplete(tempo)}
          disabled={saving || !tempo}
          class="w-full py-3 rounded-lg text-white font-medium cursor-pointer disabled:opacity-50 bg-brand-600 hover:bg-brand-700"
        >
          {meetsTarget
            ? `Practiced at ${tempo} BPM — move to Playing!`
            : `Practiced with no mistakes at ${tempo} BPM`}
        </button>
        <button
          onClick={onStruggle}
          disabled={saving}
          class="w-full py-3 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 font-medium cursor-pointer disabled:opacity-50 hover:bg-amber-100"
        >
          Can't play with metronome yet
        </button>
        <button
          onClick={onSkip}
          class="w-full py-2 text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Skip for today
        </button>
      </div>

      <PracticeSpoilers tune={tune} mainSource={mainSource} fullAbc={fullAbc} transpose={transpose} onTransposeChange={setTranspose} />
    </div>
  );
}

function PlayingCard({ tune, instrument, instData, fullAbc, mainSource, backingTracks, saving, onRate, onSkip }) {
  const playTempo = instData.target_tempo;
  const [transpose, setTranspose] = useState(tune.transpose || 0);

  return (
    <div class="space-y-4">
      <TuneHeader tune={tune} instrument={instrument} targetTempo={instData.target_tempo} />

      {/* Prompt */}
      <div class="bg-brand-50 rounded-lg border border-brand-200 p-4">
        <p class="text-sm text-brand-800 dark:text-brand-400 font-medium">
          Play at {playTempo} BPM
        </p>
      </div>

      {/* Playback + Metronome */}
      <div class="space-y-2">
        {fullAbc && <AbcPlayer abc={fullAbc} defaultTempo={playTempo} transpose={transpose} />}
        <Metronome defaultBpm={playTempo} defaultTimeSignature={getMeter(tune.type)} />
        {backingTracks.map(bt => <BackingTrackPlayer key={bt.id} attachment={bt} targetTempo={playTempo} />)}
      </div>

      {/* Rating */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <FluencyRater onRate={onRate} disabled={saving} />
      </div>

      <button
        onClick={onSkip}
        class="w-full py-2 text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
      >
        Skip for today
      </button>

      <PracticeSpoilers tune={tune} mainSource={mainSource} fullAbc={fullAbc} transpose={transpose} onTransposeChange={setTranspose} />
    </div>
  );
}
