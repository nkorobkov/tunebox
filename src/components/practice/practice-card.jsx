import { useState } from 'preact/hooks';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';
import { SheetMusicViewer } from '../tune/sheet-music-viewer';
import { Metronome } from './metronome';
import { FluencyRater } from './fluency-rater';
import { useAttachments } from '../../hooks/use-attachments';
import { buildAbcString, getDefaultTempo } from '../../lib/abc-utils';
import { calculateNextReview } from '../../lib/spaced-repetition';
import { pb } from '../../lib/pb';

export function PracticeCard({ tune, onComplete }) {
  const [saving, setSaving] = useState(false);
  const { mainSource } = useAttachments(tune.id);

  const fullAbc = tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null;

  // Use last practice tempo if available, otherwise canonical, otherwise type default
  const defaultTempo = tune.practice_tempo || tune.canonical_tempo || getDefaultTempo(tune.type);
  const [currentTempo, setCurrentTempo] = useState(defaultTempo);

  const handleRate = async (fluencyRating) => {
    setSaving(true);
    try {
      // Calculate next review
      const srUpdate = calculateNextReview({
        interval_days: tune.interval_days || 1,
        ease_factor: tune.ease_factor || 2.5,
        consecutive_correct: tune.consecutive_correct || 0,
      }, fluencyRating);

      // Update SR fields + save the tempo they practiced at
      const updated = await pb.collection('user_tunes').update(tune.id, {
        ...srUpdate,
        practice_tempo: currentTempo,
      });

      // Log the practice session
      await pb.collection('practice_log').create({
        user: pb.authStore.record.id,
        user_tune: tune.id,
        practiced_at: new Date().toISOString(),
        fluency_rating: fluencyRating,
        tempo_used: currentTempo,
      });

      onComplete(updated, fluencyRating);
    } catch (err) {
      console.error('Failed to save practice:', err);
      setSaving(false);
    }
  };

  return (
    <div class="space-y-4">
      {/* Tune header */}
      <div>
        <h2 class="text-xl font-bold text-gray-900">{tune.title}</h2>
        <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
          {tune.type && <span class="capitalize">{tune.type}</span>}
          {tune.setting_key && <span>Key: {tune.setting_key}</span>}
          {tune.canonical_tempo > 0 && (
            <span>Target: {tune.canonical_tempo} BPM</span>
          )}
          {tune.practice_tempo > 0 && tune.practice_tempo !== tune.canonical_tempo && (
            <span>Last practiced: {tune.practice_tempo} BPM</span>
          )}
        </div>
      </div>

      {/* Sheet music */}
      {mainSource ? (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <SheetMusicViewer attachment={mainSource} />
        </div>
      ) : fullAbc ? (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <AbcViewer abc={fullAbc} />
        </div>
      ) : (
        <div class="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No sheet music available for this tune
        </div>
      )}

      {/* Playback + Metronome */}
      <div class="space-y-2">
        {fullAbc && (
          <AbcPlayer abc={fullAbc} defaultTempo={currentTempo} />
        )}
        <Metronome
          defaultBpm={currentTempo}
          onTempoChange={setCurrentTempo}
        />
      </div>

      {/* Fluency rating */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <FluencyRater onRate={handleRate} disabled={saving} />
      </div>
    </div>
  );
}
