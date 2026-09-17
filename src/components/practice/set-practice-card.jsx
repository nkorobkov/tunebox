import { useState } from 'preact/hooks';
import { Metronome } from './metronome';
import { FluencyRater } from './fluency-rater';
import { BackingTrackPlayer } from './backing-track-player';
import { SheetMusic, Spoiler, useElapsedSeconds, fmtElapsed } from './practice-card';
import { NotesContent } from '../tune/tune-notes';
import { useAttachments } from '../../hooks/use-attachments';
import { useSetAttachments } from '../../hooks/use-set-attachments';
import { buildAbcString, getDefaultTempo, getMeter } from '../../lib/abc-utils';
import { getInstrumentData } from '../../lib/practice-algorithm';
import { setHref } from '../../lib/sets';

/** One member tune's notation inside the set's sheet-music spoiler. */
function TuneSheet({ tune, position, tempo }) {
  const { mainSource } = useAttachments(tune.id);
  const [transpose, setTranspose] = useState(tune.transpose || 0);
  const fullAbc = tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null;

  return (
    <div class="space-y-1.5">
      <p class="text-xs font-medium text-gray-500">{position}. {tune.title}</p>
      <SheetMusic
        mainSource={mainSource}
        fullAbc={fullAbc}
        tempo={tempo}
        transpose={transpose}
        onTransposeChange={setTranspose}
      />
    </div>
  );
}

/**
 * Active practice view for a whole set played end to end. Mirrors
 * PracticeCard, but there is one tempo, one backing track and one rating for
 * the set — the rating is then written to every tune in it. Only ready sets
 * (all tunes learned, one shared target tempo) reach this card, so playing
 * mode is the only mode it needs.
 */
export function SetPracticeCard({ item, instrument, onCompleteSet, onSkip }) {
  const [saving, setSaving] = useState(false);
  const { backingTracks } = useSetAttachments(item.key, item.name);
  const elapsed = useElapsedSeconds();

  const first = item.tunes[0];
  const instDataFor = (t) => getInstrumentData(t, instrument, t.canonical_tempo || getDefaultTempo(t.type));
  const targetTempo = instDataFor(first).target_tempo;
  // One rating covers every tune, so the set comes back as soon as its
  // shakiest member does — rate the intervals off the lowest stability.
  const stability = Math.min(...item.tunes.map(t => instDataFor(t).stability));
  const [tempo, setTempo] = useState(targetTempo);

  const handleRate = async (rating) => {
    setSaving(true);
    try {
      await onCompleteSet(item, rating, tempo, elapsed);
    } catch (err) {
      console.error('Failed to save set practice:', err);
    } finally {
      setSaving(false);
    }
  };

  const noted = item.tunes.filter(t => t.notes);

  return (
    <div class="space-y-4">
      {/* Header + timer */}
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-[11px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 dark:text-brand-400">Set</span>
            <h2 class="text-xl font-bold text-gray-900 truncate">
              <a href={setHref(item.name)} class="hover:text-blue-600 no-underline text-gray-900">{item.name}</a>
            </h2>
          </div>
          <p class="text-sm text-gray-500 mt-1">
            {item.tunes.map((t, i) => (
              <span key={t.id}>
                {i > 0 && <span class="text-gray-300"> → </span>}
                <a href={`/tune/${t.id}`} class="no-underline text-gray-500 hover:text-blue-600">{t.title}</a>
              </span>
            ))}
          </p>
          <div class="flex items-center gap-3 mt-1 text-sm text-gray-400">
            <span>{instrument}</span>
            {targetTempo > 0 && <span>Target: {targetTempo} BPM</span>}
          </div>
        </div>
        <span
          class="text-sm text-gray-400 shrink-0 mt-1"
          style="font-variant-numeric: tabular-nums"
          title="Time on this set"
        >{fmtElapsed(elapsed)}</span>
      </div>

      {/* Tempo + metronome */}
      <div class="space-y-1.5">
        <p class="text-sm text-gray-500">
          Play all {item.tunes.length} tunes through at {targetTempo} BPM.
        </p>
        <Metronome
          tempo={tempo}
          onTempoChange={setTempo}
          targetTempo={targetTempo}
          defaultTimeSignature={getMeter(first.type)}
        />
      </div>

      {/* The set's own backing tracks */}
      {backingTracks.length > 0 ? (
        <div class="space-y-2">
          {backingTracks.map(bt => (
            <BackingTrackPlayer key={bt.id} attachment={bt} targetTempo={tempo} />
          ))}
        </div>
      ) : (
        <p class="text-xs text-gray-400">
          No backing track for this set yet — <a href={setHref(item.name)} class="text-blue-600 hover:underline">record one on the set page</a>.
        </p>
      )}

      {/* One rating for the whole set */}
      <div class="space-y-1">
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <FluencyRater onRate={handleRate} disabled={saving} stability={stability} />
          <p class="text-xs text-gray-400 mt-2 text-center">
            Recorded against all {item.tunes.length} tunes in the set.
          </p>
        </div>
        <div class="text-center py-1.5">
          <button onClick={onSkip} class="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">
            Skip for today
          </button>
        </div>
      </div>

      <div class="border-t border-gray-200 pt-1">
        <Spoiler label="sheet music">
          <div class="space-y-4">
            {item.tunes.map((tune, i) => (
              <TuneSheet key={tune.id} tune={tune} position={i + 1} tempo={tempo} />
            ))}
          </div>
        </Spoiler>
        {noted.length > 0 && (
          <Spoiler label="notes">
            <div class="space-y-3">
              {noted.map(tune => (
                <div key={tune.id} class="bg-white rounded-lg border border-gray-200 p-4">
                  <p class="text-xs font-medium text-gray-500 mb-1.5">{tune.title}</p>
                  <NotesContent notes={tune.notes} />
                </div>
              ))}
            </div>
          </Spoiler>
        )}
      </div>
    </div>
  );
}
