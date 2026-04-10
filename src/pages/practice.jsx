import { useState } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { PracticeCard } from '../components/practice/practice-card';
import { usePractice } from '../hooks/use-practice';

export function PracticePage() {
  const { currentTune, remaining, loading, advance, updateCurrentTune, totalDue } = usePractice();
  const [lastResult, setLastResult] = useState(null);

  const handleComplete = (updatedTune, rating) => {
    updateCurrentTune(updatedTune);
    const labels = ['', 'Blackout', 'Hard', 'OK', 'Good', 'Easy'];
    setLastResult({
      title: updatedTune.title,
      rating: labels[rating],
      nextReview: updatedTune.next_review,
      intervalDays: updatedTune.interval_days,
    });
    // Brief delay so user sees the result, then advance
    setTimeout(() => {
      setLastResult(null);
      advance();
    }, 1500);
  };

  return (
    <Shell>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Practice</h1>
        {!loading && totalDue > 0 && (
          <span class="text-sm text-gray-500">
            {remaining} tune{remaining !== 1 ? 's' : ''} remaining
          </span>
        )}
      </div>

      {loading ? (
        <p class="text-gray-400 text-center py-12">Loading practice queue...</p>
      ) : lastResult ? (
        <div class="text-center py-12">
          <p class="text-lg font-medium text-gray-900">{lastResult.title}</p>
          <p class="text-sm text-gray-500 mt-1">
            Rated: {lastResult.rating} — next review in {lastResult.intervalDays} day{lastResult.intervalDays !== 1 ? 's' : ''}
          </p>
        </div>
      ) : !currentTune ? (
        <div class="text-center py-12">
          <p class="text-2xl mb-2">All done!</p>
          <p class="text-gray-500">
            {totalDue === 0
              ? 'No tunes to practice. Add tunes to your collection and they\'ll appear here.'
              : 'You\'ve completed your practice session. Great work!'}
          </p>
          {totalDue > 0 && (
            <a href="/" class="text-sm text-blue-600 hover:underline mt-4 inline-block">
              Back to library
            </a>
          )}
        </div>
      ) : (
        <PracticeCard tune={currentTune} onComplete={handleComplete} />
      )}
    </Shell>
  );
}
