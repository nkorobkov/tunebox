import { useState } from 'preact/hooks';
import { Button } from '../common/button';
import { practicedToday } from '../../lib/practice-algorithm';

function fmtDuration(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function outcomeLabel(e) {
  switch (e.outcome) {
    case 'moved': return { text: `${e.tempo} BPM — moved to playing!`, cls: 'text-brand-700 dark:text-brand-400 font-medium' };
    case 'progress': {
      const gain = e.prevTempo > 0 ? e.tempo - e.prevTempo : 0;
      return { text: gain > 0 ? `${e.tempo} BPM (+${gain})` : `${e.tempo} BPM`, cls: 'text-gray-600' };
    }
    case 'struggle': return { text: 'Still working on it', cls: 'text-amber-700' };
    case 'easy': return { text: 'Easy', cls: 'text-brand-700 dark:text-brand-400' };
    case 'good': return { text: 'Good', cls: 'text-gray-600' };
    case 'hard': return { text: 'Hard', cls: 'text-amber-700' };
    case 'relearn': return { text: 'Back to learning', cls: 'text-red-600' };
    case 'skip': return { text: 'Skipped', cls: 'text-gray-400' };
    default: return { text: '', cls: 'text-gray-400' };
  }
}

function Stat({ label, value }) {
  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 text-center">
      <div class="text-2xl font-semibold text-gray-900">{value}</div>
      <div class="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

/**
 * "What else could I practice right now" — shared between the session
 * summary and the single-tune post-practice screen.
 */
export function MoreTunes({ learning, playing, notStarted, instrument, onStartLearning }) {
  const [expandNotStarted, setExpandNotStarted] = useState(false);
  const [savingTuneId, setSavingTuneId] = useState(null);

  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const practiceable = [...learning, ...playing];
  const due = practiceable.filter(t => !practicedToday(t, instrument)).sort(byTitle);
  const done = practiceable.filter(t => practicedToday(t, instrument)).sort(byTitle);

  const handleStartLearning = async (tune) => {
    if (savingTuneId) return;
    setSavingTuneId(tune.id);
    try {
      await onStartLearning(tune);
    } finally {
      setSavingTuneId(null);
    }
  };

  if (due.length === 0 && done.length === 0 && notStarted.length === 0) return null;

  const tuneLink = (tune) => (
    <li key={tune.id}>
      <a
        href={`/practice?tune=${tune.id}`}
        class="text-sm text-blue-600 hover:text-blue-700 no-underline hover:underline"
      >
        {tune.title}
      </a>
    </li>
  );

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h3 class="text-sm font-medium text-gray-700">More tunes on {instrument}</h3>
      {due.length > 0 && (
        <div>
          <p class="text-xs text-gray-400 mb-1">Still to practice today</p>
          <ul class="leading-tight">{due.map(tuneLink)}</ul>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <p class="text-xs text-gray-400 mb-1">Practiced today — review again</p>
          <ul class="leading-tight">{done.map(tuneLink)}</ul>
        </div>
      )}
      {notStarted.length > 0 && onStartLearning && (
        <div>
          <button
            onClick={() => setExpandNotStarted(!expandNotStarted)}
            class="flex items-center justify-between w-full cursor-pointer"
          >
            <span class="text-xs text-gray-400">Start learning ({notStarted.length})</span>
            <span class="text-gray-400 text-xs">{expandNotStarted ? 'hide' : 'show'}</span>
          </button>
          {expandNotStarted && (
            <div class="mt-1 space-y-1">
              {notStarted.map(tune => (
                <div key={tune.id} class="flex items-center justify-between py-1">
                  <span class="text-sm text-gray-800 truncate">{tune.title}</span>
                  <button
                    onClick={() => handleStartLearning(tune)}
                    disabled={savingTuneId === tune.id}
                    class="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 cursor-pointer shrink-0 ml-2"
                  >
                    {savingTuneId === tune.id ? 'Adding...' : 'Start learning'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionSummary({ entries, instrument, learning, playing, notStarted, onStartLearning, onBackHome }) {
  const practiced = entries.filter(e => e.outcome !== 'skip');
  const totalSec = entries.reduce((s, e) => s + (e.durationSec || 0), 0);
  const tempoUps = entries.filter(e =>
    e.mode === 'learning' && (e.outcome === 'moved' || e.outcome === 'progress') && e.tempo > (e.prevTempo || 0)
  ).length;
  const moved = entries.filter(e => e.outcome === 'moved').length;

  const stats = [
    { label: 'Tunes practiced', value: practiced.length },
    { label: 'Time', value: fmtDuration(totalSec) },
    { label: 'Tempo ups', value: tempoUps },
    ...(moved > 0 ? [{ label: 'Moved to playing', value: moved }] : []),
  ];

  return (
    <div class="space-y-6">
      <div class="text-center pt-4">
        <p class="text-2xl font-bold text-gray-900">Session complete!</p>
        <p class="text-sm text-gray-500 mt-1">{instrument}</p>
      </div>

      <div class={`grid gap-2 ${stats.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {stats.map(s => <Stat key={s.label} label={s.label} value={s.value} />)}
      </div>

      {entries.length > 0 && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">This session</h3>
          <ul class="space-y-1.5">
            {entries.map((e, i) => {
              const o = outcomeLabel(e);
              return (
                <li key={i} class="flex items-center justify-between gap-2 text-sm">
                  <a href={`/tune/${e.tune.id}`} class="text-gray-800 no-underline hover:text-blue-600 truncate">{e.tune.title}</a>
                  <span class={`shrink-0 ${o.cls}`}>{o.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <MoreTunes
        learning={learning}
        playing={playing}
        notStarted={notStarted}
        instrument={instrument}
        onStartLearning={onStartLearning}
      />

      <div class="flex items-center justify-center gap-3">
        <Button variant="secondary" size="lg" onClick={onBackHome}>Back to practice home</Button>
        <Button variant="ghost" size="lg" href="/">Back to library</Button>
      </div>
    </div>
  );
}
