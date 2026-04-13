import { useState } from 'preact/hooks';
import { getDefaultTempo } from '../../lib/abc-utils';

export function PracticeEntry({ userInstruments, selectedInstrument, onSelectInstrument, learning, playing, wantToLearn, onStart, onStartLearning, allDoneForToday, onReviewAgain }) {
  const [expandWantToLearn, setExpandWantToLearn] = useState(false);
  const [expandingTuneId, setExpandingTuneId] = useState(null);
  const [targetBpm, setTargetBpm] = useState('');
  const [learnInstrument, setLearnInstrument] = useState(selectedInstrument);
  const [saving, setSaving] = useState(false);

  const totalPracticeable = learning.length + playing.length;

  const handleExpandLearning = (tune) => {
    if (expandingTuneId === tune.id) {
      setExpandingTuneId(null);
      return;
    }
    const defaultBpm = tune.canonical_tempo || getDefaultTempo(tune.type) || 100;
    setTargetBpm(defaultBpm);
    setLearnInstrument(selectedInstrument);
    setExpandingTuneId(tune.id);
  };

  const handleConfirmLearning = async (tune) => {
    if (!learnInstrument || !targetBpm) return;
    setSaving(true);
    try {
      await onStartLearning(tune, Number(targetBpm), learnInstrument);
      setExpandingTuneId(null);
      setTargetBpm('');
    } finally {
      setSaving(false);
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
            <div class="mt-3 space-y-1">
              {wantToLearn.map(tune => (
                <div key={tune.id}>
                  <div class="flex items-center justify-between py-1.5">
                    <div class="min-w-0">
                      <span class="text-sm text-gray-800 truncate block">{tune.title}</span>
                      <span class="text-xs text-gray-400">
                        {tune.type && <span class="capitalize">{tune.type}</span>}
                        {tune.canonical_tempo > 0 && <span> — {tune.canonical_tempo} BPM</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => handleExpandLearning(tune)}
                      class="text-xs text-blue-600 hover:text-blue-700 cursor-pointer shrink-0 ml-2"
                    >
                      {expandingTuneId === tune.id ? 'Cancel' : 'Start learning'}
                    </button>
                  </div>

                  {expandingTuneId === tune.id && (
                    <div class="ml-1 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      {/* Instrument picker */}
                      {userInstruments.length > 1 && (
                        <div>
                          <label class="text-xs text-gray-500 block mb-1">Instrument</label>
                          <div class="flex shrink-0">
                            {userInstruments.map((inst, i) => (
                              <button
                                key={inst}
                                onClick={() => setLearnInstrument(inst)}
                                class={`text-xs px-2 py-1.5 cursor-pointer capitalize border border-gray-300 ${
                                  i === 0 ? 'rounded-l' : ''
                                }${i === userInstruments.length - 1 ? ' rounded-r' : ''
                                }${i > 0 ? ' -ml-px' : ''} ${
                                  learnInstrument === inst
                                    ? 'bg-blue-600 text-white border-blue-600 z-10 relative'
                                    : 'bg-white text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {inst}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* BPM + Add button */}
                      <div class="flex items-end gap-2">
                        <div class="flex-1">
                          <label class="text-xs text-gray-500 block mb-1">Target BPM</label>
                          <input
                            type="number"
                            value={targetBpm}
                            onInput={e => setTargetBpm(e.target.value)}
                            class="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleConfirmLearning(tune)}
                          disabled={!targetBpm || saving}
                          class="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {saving ? 'Adding...' : 'Add to learning'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
