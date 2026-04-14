export function LabelFilter({ tunes, selectedLabel, onSelect }) {
  // Extract all unique labels from tunes
  const allLabels = new Map();
  for (const tune of tunes) {
    for (const label of (tune.labels || [])) {
      if (label.type === 'set' || label.type === 'proficiency') continue;
      const key = `${label.type}:${label.value}`;
      if (!allLabels.has(key)) {
        allLabels.set(key, { ...label, count: 0 });
      }
      allLabels.get(key).count++;
    }
  }

  const labels = [...allLabels.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.value.localeCompare(b.value);
  });

  if (labels.length === 0) return null;

  return (
    <div class="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        class={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
          !selectedLabel
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
        }`}
      >
        All
      </button>
      {labels.map(label => {
        const key = `${label.type}:${label.value}`;
        const active = selectedLabel === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(active ? null : key)}
            class={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {label.value} ({label.count})
          </button>
        );
      })}
    </div>
  );
}
