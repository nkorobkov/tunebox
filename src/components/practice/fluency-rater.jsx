const RATINGS = [
  { value: 1, label: 'Blackout', description: "Couldn't play it", color: 'bg-red-600 hover:bg-red-700' },
  { value: 2, label: 'Hard', description: 'Many mistakes', color: 'bg-orange-500 hover:bg-orange-600' },
  { value: 3, label: 'OK', description: 'Some hesitation', color: 'bg-yellow-500 hover:bg-yellow-600' },
  { value: 4, label: 'Good', description: 'Minor issues', color: 'bg-blue-500 hover:bg-blue-600' },
  { value: 5, label: 'Easy', description: 'Nailed it', color: 'bg-green-600 hover:bg-green-700' },
];

export function FluencyRater({ onRate, disabled }) {
  return (
    <div class="space-y-2">
      <p class="text-sm font-medium text-gray-700">How did that go?</p>
      <div class="flex gap-2">
        {RATINGS.map(r => (
          <button
            key={r.value}
            onClick={() => onRate(r.value)}
            disabled={disabled}
            class={`flex-1 py-3 px-2 rounded-lg text-white text-sm font-medium cursor-pointer disabled:opacity-50 ${r.color}`}
            title={r.description}
          >
            <div>{r.label}</div>
            <div class="text-xs opacity-75 mt-0.5">{r.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
