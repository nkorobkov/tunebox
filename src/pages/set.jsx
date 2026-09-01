import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { LoadingIndicator } from '../components/loading-indicator';
import { Button } from '../components/common/button';
import { AttachmentList } from '../components/tune/attachment-list';
import { AttachmentUpload } from '../components/tune/attachment-upload';
import { AudioRecorder } from '../components/tune/audio-recorder';
import { SetSkills } from '../components/set/set-skills';
import { SetTuneCard } from '../components/set/set-tune-card';
import { SetWarningBanner } from '../components/set/set-warning';
import { useTunes } from '../hooks/use-tunes';
import { useSetAttachments } from '../hooks/use-set-attachments';
import { useAuth } from '../lib/auth';
import { useConnectivity } from '../lib/connectivity';
import { findSet, getSetLabel, setReadiness } from '../lib/sets';
import { getDefaultInstrument, saveDefaultInstrument } from '../hooks/use-practice';

export function SetPage({ name: setNameParam }) {
  const { tunes, loading, updateTune } = useTunes();
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const [chosenInstrument, setChosenInstrument] = useState(() => getDefaultInstrument());
  const [showUpload, setShowUpload] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState('');

  const set = findSet(tunes, setNameParam);
  const setTunes = set?.tunes || [];

  const instrumentOptions = [...new Set([
    ...(user?.instruments || []),
    ...setTunes.flatMap(t => Object.keys(t.instruments || {})),
  ])];
  const instrument = instrumentOptions.includes(chosenInstrument)
    ? chosenInstrument
    : (instrumentOptions[0] || '');

  const assets = useSetAttachments(set?.key || '', set?.name || '');
  const readiness = setReadiness(setTunes, instrument);

  // Rewrite the `order` on every set label so the list order sticks.
  const applyOrder = async (ordered) => {
    setReordering(true);
    setError('');
    try {
      for (const [i, tune] of ordered.entries()) {
        const label = getSetLabel(tune);
        if (!label || label.order === i + 1) continue;
        const labels = (tune.labels || []).map(l =>
          l.type === 'set' ? { ...l, order: i + 1 } : l
        );
        await updateTune(tune.id, { labels });
      }
    } catch (err) {
      console.error('Failed to reorder set:', err);
      setError(err.message || 'Could not reorder the set.');
    } finally {
      setReordering(false);
    }
  };

  const moveTune = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= setTunes.length) return;
    const ordered = [...setTunes];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return applyOrder(ordered);
  };

  const removeTune = async (tune) => {
    setReordering(true);
    setError('');
    try {
      await updateTune(tune.id, { labels: (tune.labels || []).filter(l => l.type !== 'set') });
      await applyOrder(setTunes.filter(t => t.id !== tune.id));
    } catch (err) {
      console.error('Failed to remove tune from set:', err);
      setError(err.message || 'Could not remove that tune from the set.');
      setReordering(false);
    }
  };

  const practiceSet = () => {
    if (instrument) saveDefaultInstrument(instrument);
    route(`/practice?set=${encodeURIComponent(set.key)}`);
  };

  if (loading) {
    return <Shell><LoadingIndicator /></Shell>;
  }

  if (!set) {
    return (
      <Shell>
        <div class="text-center py-12 space-y-3">
          <p class="text-gray-400">Set not found.</p>
          <Button variant="secondary" href="/">Back to library</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div class="space-y-6">
        {/* Header */}
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <a href="/" class="text-xs text-gray-400 hover:text-gray-600 no-underline">&larr; Library</a>
            <h1 class="text-2xl font-bold text-gray-900 mt-0.5">{set.name}</h1>
            <p class="text-sm text-gray-500 mt-0.5">
              Set of {setTunes.length} tune{setTunes.length !== 1 ? 's' : ''}
              {readiness.ready && ` — ready to play at ${readiness.tempo} BPM`}
            </p>
          </div>
          <Button onClick={practiceSet} disabled={!instrument}>
            {readiness.ready ? 'Practise set' : 'Practise tunes'}
          </Button>
        </div>

        {/* Instrument picker — everything below is scoped to this instrument */}
        {instrumentOptions.length > 1 && (
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-gray-400">Instrument:</span>
            {instrumentOptions.map(inst => (
              <button
                key={inst}
                onClick={() => { setChosenInstrument(inst); saveDefaultInstrument(inst); }}
                class={`px-2.5 py-1 text-xs rounded-full border cursor-pointer ${
                  instrument === inst
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>
        )}

        <SetWarningBanner readiness={readiness} instrument={instrument} />

        {error && <p class="text-sm text-red-500">{error}</p>}

        {/* Set assets */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-sm font-medium text-gray-700">
                Set assets{assets.attachments.length > 0 && ` (${assets.attachments.length})`}
              </h3>
              <p class="text-xs text-gray-400 mt-0.5">Backing tracks and recordings for the whole set.</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                onClick={() => setShowRecorder(true)}
                disabled={isOffline}
                title={isOffline ? 'Unavailable offline' : undefined}
                class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Record
              </button>
              <span class="text-gray-300">|</span>
              <button
                onClick={() => setShowUpload(true)}
                disabled={isOffline}
                title={isOffline ? 'Unavailable offline' : undefined}
                class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
          {assets.loading ? (
            <p class="text-sm text-gray-400">Loading...</p>
          ) : assets.attachments.length === 0 ? (
            <p class="text-sm text-gray-400">
              Nothing yet — record a backing track for the set and it plays on the practice card.
            </p>
          ) : (
            <AttachmentList
              attachments={assets.attachments}
              onDelete={assets.remove}
              onUpdate={assets.update}
            />
          )}
        </div>

        {/* Skill settings across the set */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Skill settings for all tunes</h3>
          <SetSkills tunes={setTunes} />
        </div>

        {/* The tunes themselves */}
        <div class="space-y-4">
          <h3 class="text-sm font-medium text-gray-700">Tunes in order</h3>
          {setTunes.map((tune, i) => (
            <SetTuneCard
              key={tune.id}
              tune={tune}
              position={i + 1}
              instrument={instrument}
              canMoveUp={i > 0}
              canMoveDown={i < setTunes.length - 1}
              busy={reordering}
              onMove={(delta) => moveTune(i, delta)}
              onRemove={() => removeTune(tune)}
            />
          ))}
        </div>
      </div>

      {showUpload && (
        <AttachmentUpload
          onUpload={assets.upload}
          onClose={() => setShowUpload(false)}
        />
      )}
      {showRecorder && (
        <AudioRecorder onUpload={assets.upload} onClose={() => setShowRecorder(false)} />
      )}
    </Shell>
  );
}
