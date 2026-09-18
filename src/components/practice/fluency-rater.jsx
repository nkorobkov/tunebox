import { nextIntervalDays, formatInterval } from '../../lib/practice-algorithm';

const RATINGS = [
  { value: 'easy', label: 'Easy', description: 'Nailed it', color: 'bg-brand-600 hover:bg-brand-700' },
  { value: 'good', label: 'Good', description: 'Minor issues', color: 'bg-brand-500 hover:bg-brand-600' },
  { value: 'hard', label: 'Hard', description: 'Struggled', color: 'bg-orange-500 hover:bg-orange-600' },
];

/**
 * Playing-mode rating buttons. Each carries the rest interval that rating
 * buys — how long before the tune comes due again — the way Anki does, so
 * the trade-off is visible before the tap. Pass the tune's current stability
 * (days) and how long it has rested; growth is scaled by the gap, so a tune
 * played early honestly shows a smaller number. Omit `stability` and the
 * intervals are left off.
 */
export function FluencyRater({ onRate, disabled, stability, elapsedDays = 0 }) {
  const showIntervals = typeof stability === 'number';

  return (
    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700">How did that go?</p>
      <div class="grid grid-cols-3 gap-2">
        {RATINGS.map(r => (
          <button
            key={r.value}
            onClick={() => onRate(r.value)}
            disabled={disabled}
            class={`py-3 px-2 rounded-lg text-white font-medium cursor-pointer disabled:opacity-50 ${r.color}`}
            title={r.description}
          >
            <div>{r.label}</div>
            <div class="text-xs opacity-75 mt-0.5">{r.description}</div>
            {showIntervals && (
              <div class="text-xs font-semibold opacity-90 mt-1" style="font-variant-numeric: tabular-nums">
                {formatInterval(nextIntervalDays(stability, r.value, elapsedDays))}
              </div>
            )}
          </button>
        ))}
      </div>
      <div class="text-center pt-1">
        <button
          onClick={() => onRate('relearn')}
          disabled={disabled}
          class="text-xs text-red-600 hover:text-red-700 cursor-pointer disabled:opacity-50"
        >
          Couldn't play it — need to relearn
        </button>
      </div>
    </div>
  );
}
