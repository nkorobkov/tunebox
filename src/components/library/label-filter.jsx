export function LabelFilter({
  tunes,
  selectedLabel,
  onSelect,
  proficiencyFilter,
  onProficiencyChange,
  instrumentFilter,
  onInstrumentChange,
  instruments,
}) {
  // Extract all unique labels from tunes (tags only — exclude set and proficiency)
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

  const hasAnyFilter = labels.length > 0 || instruments.length > 0;
  if (!hasAnyFilter) return null;

  const pill = (active) => `text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
    active
      ? 'bg-blue-600 text-white border-blue-600'
      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
  }`;

  return (
    <div class="flex flex-wrap items-center gap-2">
      {labels.length > 0 && (
        <>
          <button onClick={() => onSelect(null)} class={`text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
            !selectedLabel ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}>All</button>
          {labels.map(label => {
            const key = `${label.type}:${label.value}`;
            return (
              <button key={key} onClick={() => onSelect(selectedLabel === key ? null : key)} class={pill(selectedLabel === key)}>
                {label.value} ({label.count})
              </button>
            );
          })}
        </>
      )}

      {instruments.length > 0 && (
        <>
          {labels.length > 0 && <span class="w-px h-4 bg-gray-300" />}
          <button onClick={() => onProficiencyChange(proficiencyFilter === 'learning' ? '' : 'learning')} class={pill(proficiencyFilter === 'learning')}>
            learning
          </button>
          <button onClick={() => onProficiencyChange(proficiencyFilter === 'playing' ? '' : 'playing')} class={pill(proficiencyFilter === 'playing')}>
            playing
          </button>
          <span class="w-px h-4 bg-gray-300" />
          {instruments.map(name => (
            <button key={name} onClick={() => onInstrumentChange(instrumentFilter === name ? '' : name)} class={pill(instrumentFilter === name)}>
              {name}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
