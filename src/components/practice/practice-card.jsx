import { useState } from 'preact/hooks';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';
import { SheetMusicViewer } from '../tune/sheet-music-viewer';
import { Metronome } from './metronome';
import { FluencyRater } from './fluency-rater';
import { useAttachments } from '../../hooks/use-attachments';
import { buildAbcString, getDefaultTempo, getMeter } from '../../lib/abc-utils';
import { getInstrumentData, suggestLearningTempo } from '../../lib/practice-algorithm';

export function PracticeCard({ tune, instrument, onCompleteLearning, onStruggleLearning, onCompletePlaying, onSkip }) {
  const [saving, setSaving] = useState(false);
  const { mainSource } = useAttachments(tune.id);

  const proficiency = tune.labels?.find(l => l.type === 'proficiency')?.value || 'want to learn';
  const isLearning = proficiency === 'learning';

  const fallbackTempo = tune.canonical_tempo || getDefaultTempo(tune.type);
  const instData = getInstrumentData(tune, instrument, fallbackTempo);

  const fullAbc = tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null;

  const handleLearningComplete = async (tempo) => {
    setSaving(true);
    try {
      await onCompleteLearning(tune, tempo);
    } catch (err) {
      console.error('Failed to save practice:', err);
      setSaving(false);
    }
  };

  const handleLearningStruggle = async () => {
    setSaving(true);
    try {
      await onStruggleLearning(tune);
    } catch (err) {
      console.error('Failed to save practice:', err);
      setSaving(false);
    }
  };

  const handlePlayingRate = async (rating) => {
    setSaving(true);
    try {
      await onCompletePlaying(tune, rating);
    } catch (err) {
      console.error('Failed to save practice:', err);
      setSaving(false);
    }
  };

  if (isLearning) {
    return (
      <LearningCard
        tune={tune}
        instrument={instrument}
        instData={instData}
        fullAbc={fullAbc}
        mainSource={mainSource}
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
      saving={saving}
      onRate={handlePlayingRate}
      onSkip={onSkip}
    />
  );
}

function TuneHeader({ tune, instrument }) {
  return (
    <div>
      <h2 class="text-xl font-bold text-gray-900">{tune.title}</h2>
      <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
        {tune.type && <span class="capitalize">{tune.type}</span>}
        {tune.setting_key && <span>Key: {tune.setting_key}</span>}
        <span class="text-gray-400">{instrument}</span>
      </div>
    </div>
  );
}

function SheetMusic({ mainSource, fullAbc }) {
  if (mainSource) {
    return (
      <div class="bg-white lg:rounded-lg lg:border lg:border-gray-200 lg:p-4">
        <SheetMusicViewer attachment={mainSource} />
      </div>
    );
  }
  if (fullAbc) {
    return (
      <div class="bg-white lg:rounded-lg lg:border lg:border-gray-200 lg:p-4 practice-abc">
        <AbcViewer abc={fullAbc} />
      </div>
    );
  }
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
      No sheet music available for this tune
    </div>
  );
}

function LearningCard({ tune, instrument, instData, fullAbc, mainSource, saving, onComplete, onStruggle, onSkip }) {
  const { suggestion, isFirstTime } = suggestLearningTempo(instData.current_tempo);
  const [tempo, setTempo] = useState(suggestion);
  const meetsTarget = tempo >= instData.target_tempo;

  return (
    <div class="space-y-4">
      <TuneHeader tune={tune} instrument={instrument} />

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

      <SheetMusic mainSource={mainSource} fullAbc={fullAbc} />

      {/* Playback + Metronome */}
      <div class="space-y-2">
        {fullAbc && <AbcPlayer abc={fullAbc} defaultTempo={tempo} />}
        <Metronome defaultBpm={tempo} defaultTimeSignature={getMeter(tune.type)} onTempoChange={setTempo} />
      </div>

      {/* Complete button */}
      <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <button
          onClick={() => onComplete(tempo)}
          disabled={saving || !tempo}
          class={`w-full py-3 rounded-lg text-white font-medium cursor-pointer disabled:opacity-50 ${
            meetsTarget ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
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
    </div>
  );
}

function PlayingCard({ tune, instrument, instData, fullAbc, mainSource, saving, onRate, onSkip }) {
  const playTempo = instData.target_tempo;

  return (
    <div class="space-y-4">
      <TuneHeader tune={tune} instrument={instrument} />

      {/* Prompt */}
      <div class="bg-green-50 rounded-lg border border-green-200 p-4">
        <p class="text-sm text-green-800 font-medium">
          Play at {playTempo} BPM
        </p>
      </div>

      <SheetMusic mainSource={mainSource} fullAbc={fullAbc} />

      {/* Playback + Metronome */}
      <div class="space-y-2">
        {fullAbc && <AbcPlayer abc={fullAbc} defaultTempo={playTempo} />}
        <Metronome defaultBpm={playTempo} defaultTimeSignature={getMeter(tune.type)} />
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
    </div>
  );
}
