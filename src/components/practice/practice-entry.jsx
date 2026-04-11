import { useState } from 'preact/hooks';
import { getDefaultTempo } from '../../lib/abc-utils';

export function PracticeEntry({ userInstruments, selectedInstrument, onSelectInstrument, learning, playing, wantToLearn, onStart, onStartLearning, allDoneForToday, onReviewAgain }) {
  const [expandWantToLearn, setExpandWantToLearn] = useState(false);
  const [learningTune, setLearningTune] = useState(null);
  const [targetBpm, setTargetBpm] = useState('');

  const totalPracticeable = learning.length + playing.length;

  const handleStartLearning = (tune) => {
    const defaultBpm = tune.canonical_tempo || getDefaultTempo(tune.type) || 100;
    setTargetBpm(defaultBpm);
    setLearningTune(tune);
  };

  const handleConfirmLearning = async () => {
    if (!learningTune || !selectedInstrument) return;
    await onStartLearning(learningTune, Number(targetBpm));
    setLearningTune(null);
    setTargetBpm('');
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
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>
        ) : (
          <p class="text-sm text-gray-400">
            No instruments configured. <a href="/settings" class="text-blue-500 hover:underline">Add instruments in Settings</a>.
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
                class="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 cursor-pointer"
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
                class="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Start Practice
              </button>
            </div>
          )}
        </div>
      )}

      {/* Want to learn */}
      {selectedInstrument && wantToLearn.length > 0 && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <button
            onClick={() => setExpandWantToLearn(!expandWantToLearn)}
            class="flex items-center justify-between w-full cursor-pointer"
          >
            <h3 class="text-sm font-medium text-gray-700">
              Want to learn ({wantToLearn.length})
            </h3>
            <span class="text-gray-400 text-xs">{expandWantToLearn ? 'hide' : 'show'}</span>
          </button>

          {expandWantToLearn && (
            <div class="mt-3 space-y-2">
              {wantToLearn.map(tune => (
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
                    class="text-xs text-blue-600 hover:text-blue-700 cursor-pointer shrink-0 ml-2"
                  >
                    Start learning
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Start learning dialog */}
      {learningTune && (
        <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-lg p-6 w-full max-w-sm shadow-lg">
            <h3 class="text-lg font-semibold text-gray-900 mb-1">
              Start learning: {learningTune.title}
            </h3>
            <p class="text-sm text-gray-500 mb-4">
              on {selectedInstrument}
            </p>
            <div class="mb-4">
              <label class="text-sm text-gray-600 block mb-1">Target BPM</label>
              <input
                type="number"
                value={targetBpm}
                onInput={e => setTargetBpm(e.target.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div class="flex gap-2">
              <button
                onClick={handleConfirmLearning}
                disabled={!targetBpm}
                class="flex-1 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                Start
              </button>
              <button
                onClick={() => { setLearningTune(null); setTargetBpm(''); }}
                class="px-4 py-2 text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
