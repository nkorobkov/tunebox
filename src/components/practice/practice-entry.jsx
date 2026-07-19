import { useState } from 'preact/hooks';
import { useConnectivity } from '../../lib/connectivity';
import { practicedToday, dueInDays } from '../../lib/practice-algorithm';

export function PracticeEntry({ userInstruments, selectedInstrument, onSelectInstrument, learning, playing, dueLearning = [], duePlaying = [], practicedCount = 0, todayEntries = null, notStarted, onStart, onStartLearning, allDoneForToday, onReviewAgain, allTags = [], selectedTags = [], onToggleTag }) {
  const { isOffline } = useConnectivity();
  const [expandNotStarted, setExpandNotStarted] = useState(false);
  const [expandReview, setExpandReview] = useState(false);
  const [savingTuneId, setSavingTuneId] = useState(null);

  const totalPracticeable = learning.length + playing.length;
  const totalDue = dueLearning.length + duePlaying.length;
  const restingCount = totalPracticeable - totalDue - practicedCount;
  const scheduledTunes = [...learning, ...playing].sort((a, b) => a.title.localeCompare(b.title));

  // Schedule annotation for the review list: practiced today, due now, or
  // resting until the forgetting-risk model brings the tune back.
  const scheduleLabel = (tune) => {
    if (practicedToday(tune, selectedInstrument)) return '✓ today';
    const d = dueInDays(tune, selectedInstrument);
    if (d <= 0) return 'due';
    return `in ${Math.ceil(d)}d`;
  };

  const handleStartLearning = async (tune) => {
    if (savingTuneId) return;
    setSavingTuneId(tune.id);
    try {
      await onStartLearning(tune);
    } finally {
      setSavingTuneId(null);
    }
  };

  return (
    <div class="space-y-6">
      {/* Instrument picker */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <label class="text-sm font-medium text-gray-700 block mb-2">Practice instrument</label>
        {userInstruments.length > 0 ? (
          <div class="flex gap-2 flex-wrap">
            {userInstruments.map(inst => (
              <button
                key={inst}
                onClick={() => onSelectInstrument(inst)}
                class={`px-3 py-1.5 text-sm rounded-md border cursor-pointer ${
                  selectedInstrument === inst
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>
        ) : (
          <p class="text-sm text-gray-400">
            No instruments configured. <a href="/settings" class="text-blue-600 hover:underline">Add instruments in Settings</a>.
          </p>
        )}
      </div>

      {/* Queue summary */}
      {selectedInstrument && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          {allDoneForToday ? (
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900">All done for today!</p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {practicedCount} tune{practicedCount !== 1 ? 's' : ''} practiced
                  {restingCount > 0 && `, ${restingCount} resting`}
                </p>
              </div>
              <button
                onClick={onReviewAgain}
                class="px-5 py-2.5 max-[420px]:px-3 max-[420px]:py-1.5 max-[420px]:text-sm bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 cursor-pointer"
              >
                Review again
              </button>
            </div>
          ) : totalDue === 0 && totalPracticeable > 0 ? (
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-900">Nothing due today</p>
                <p class="text-xs text-gray-400 mt-0.5">
                  All {totalPracticeable} tune{totalPracticeable !== 1 ? 's' : ''} resting — review anyway?
                </p>
              </div>
              <button
                onClick={onReviewAgain}
                class="px-5 py-2.5 max-[420px]:px-3 max-[420px]:py-1.5 max-[420px]:text-sm bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 cursor-pointer"
              >
                Review
              </button>
            </div>
          ) : (
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">
                  <span class="font-medium text-gray-900">{totalDue}</span> tune{totalDue !== 1 ? 's' : ''} to practice
                </p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {dueLearning.length} learning, {duePlaying.length} playing
                  {restingCount > 0 && ` · ${restingCount} resting`}
                </p>
              </div>
              <button
                onClick={onStart}
                disabled={totalDue === 0}
                class="px-5 py-2.5 max-[420px]:px-3 max-[420px]:py-1.5 max-[420px]:text-sm bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 cursor-pointer"
              >
                Start practice
              </button>
            </div>
          )}
          {allTags.length > 0 && (
            <div class="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-gray-100">
              <span class="text-xs text-gray-400 mr-0.5">Filter:</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  class={`px-2.5 py-1 text-xs rounded-full border cursor-pointer ${
                    selectedTags.includes(tag)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Today's practice so far */}
      {selectedInstrument && todayEntries && todayEntries.length > 0 && (
        <TodayStats entries={todayEntries} />
      )}

      {/* Review — quick links to any scheduled tune */}
      {selectedInstrument && scheduledTunes.length > 0 && (() => {
        const collapsible = scheduledTunes.length > 5;
        const showList = !collapsible || expandReview;
        return (
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <button
              onClick={() => collapsible && setExpandReview(!expandReview)}
              class={`flex items-center justify-between w-full ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <h3 class="text-sm font-medium text-gray-700">
                Review{collapsible ? ` (${scheduledTunes.length})` : ''}
              </h3>
              {collapsible && (
                <span class="text-gray-400 text-xs">{expandReview ? 'hide' : 'show'}</span>
              )}
            </button>
            {showList && (
              <ul class="leading-tight mt-2 space-y-0.5">
                {scheduledTunes.map(tune => (
                  <li key={tune.id} class="flex items-center justify-between gap-2">
                    <a
                      href={`/practice?tune=${tune.id}`}
                      class="text-sm text-blue-600 hover:text-blue-700 no-underline hover:underline truncate"
                    >
                      {tune.title}
                    </a>
                    <span class="text-xs text-gray-400 shrink-0">{scheduleLabel(tune)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* Start learning */}
      {selectedInstrument && notStarted.length > 0 && !isOffline && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <button
            onClick={() => setExpandNotStarted(!expandNotStarted)}
            class="flex items-center justify-between w-full cursor-pointer"
          >
            <h3 class="text-sm font-medium text-gray-700">
              Start learning ({notStarted.length})
            </h3>
            <span class="text-gray-400 text-xs">{expandNotStarted ? 'hide' : 'show'}</span>
          </button>

          {expandNotStarted && (
            <div class="mt-3 space-y-1">
              {notStarted.map(tune => (
                <div key={tune.id} class="flex items-center justify-between py-1.5">
                  <div class="min-w-0">
                    <span class="text-sm text-gray-800 truncate block">{tune.title}</span>
                    <span class="text-xs text-gray-400">
                      {tune.type && <span class="capitalize">{tune.type}</span>}
                      {tune.canonical_tempo > 0 && <span> — {tune.canonical_tempo} BPM</span>}
                    </span>
                  </div>
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

/**
 * Summary of practice already done today (from practice_log), grouped per
 * tune, newest first. Entries carry a `title` resolved by the page.
 */
function TodayStats({ entries }) {
  const byTune = new Map();
  for (const e of entries) {
    if (!byTune.has(e.user_tune)) byTune.set(e.user_tune, []);
    byTune.get(e.user_tune).push(e);
  }
  const tuneCount = byTune.size;

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="flex items-baseline justify-between">
        <h3 class="text-sm font-medium text-gray-700">Practiced today</h3>
        <span class="text-xs text-gray-400">
          {tuneCount} tune{tuneCount !== 1 ? 's' : ''}
          {entries.length !== tuneCount && `, ${entries.length} practices`}
        </span>
      </div>
      <ul class="space-y-1.5 mt-2.5">
        {[...byTune.values()].map(list => {
          const latest = list[0];
          return (
            <li key={latest.user_tune} class="flex items-center justify-between gap-2 text-sm">
              <a
                href={`/tune/${latest.user_tune}`}
                class="text-gray-800 no-underline hover:text-blue-600 truncate"
              >
                {latest.title}
              </a>
              <span class="text-xs text-gray-500 shrink-0">
                {list.length > 1 && `×${list.length} — `}
                {latest.tempo_used > 0 ? `${latest.tempo_used} BPM` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
