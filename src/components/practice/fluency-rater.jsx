const RATINGS = [
  { value: 'easy', label: 'Easy', description: 'Nailed it', color: 'bg-brand-600 hover:bg-brand-700' },
  { value: 'good', label: 'Good', description: 'Minor issues', color: 'bg-brand-500 hover:bg-brand-600' },
  { value: 'hard', label: 'Hard', description: 'Struggled', color: 'bg-orange-500 hover:bg-orange-600' },
];

export function FluencyRater({ onRate, disabled }) {
  return (
    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700">How did that go?</p>
      <div class="grid grid-cols-3 gap-2">
        {RATINGS.map(r => (
          <button
            key={r.value}
            onClick={() => onRate(r.value)}
            disabled={disabled}
            class={`py-4 px-2 rounded-lg text-white font-medium cursor-pointer disabled:opacity-50 ${r.color}`}
            title={r.description}
          >
            <div>{r.label}</div>
            <div class="text-xs opacity-75 mt-0.5">{r.description}</div>
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
