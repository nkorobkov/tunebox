import { useState } from 'preact/hooks';
import { useConnectivity } from '../../lib/connectivity';

export function PracticeEntry({ userInstruments, selectedInstrument, onSelectInstrument, learning, playing, notStarted, onStart, onStartLearning, allDoneForToday, onReviewAgain, allTags = [], selectedTags = [], onToggleTag }) {
  const { isOffline } = useConnectivity();
  const [expandNotStarted, setExpandNotStarted] = useState(false);
  const [expandReview, setExpandReview] = useState(false);
  const [savingTuneId, setSavingTuneId] = useState(null);

  const totalPracticeable = learning.length + playing.length;
  const scheduledTunes = [...learning, ...playing].sort((a, b) => a.title.localeCompare(b.title));

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
                  {totalPracticeable} tune{totalPracticeable !== 1 ? 's' : ''} practiced
                </p>
              </div>
              <button
                onClick={onReviewAgain}
                class="px-5 py-2.5 max-[420px]:px-3 max-[420px]:py-1.5 max-[420px]:text-sm bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 cursor-pointer"
              >
                Review again
              </button>
            </div>
          ) : (
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600">
                  <span class="font-medium text-gray-900">{totalPracticeable}</span> tune{totalPracticeable !== 1 ? 's' : ''} to practice
                </p>
                <p class="text-xs text-gray-400 mt-0.5">
                  {learning.length} learning, {playing.length} playing
                </p>
              </div>
              <button
                onClick={onStart}
                disabled={totalPracticeable === 0}
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
              <ul class="leading-tight mt-2">
                {scheduledTunes.map(tune => (
                  <li key={tune.id}>
                    <a
                      href={`/practice?tune=${tune.id}`}
                      class="text-sm text-blue-600 hover:text-blue-700 no-underline hover:underline"
                    >
                      {tune.title}
                    </a>
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
