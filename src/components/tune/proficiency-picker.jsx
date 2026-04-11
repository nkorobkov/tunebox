const LEVELS = ['want to learn', 'learning', 'playing', 'retired'];

export function ProficiencyPicker({ labels = [], onUpdate }) {
  const current = labels.find(l => l.type === 'proficiency')?.value || 'want to learn';

  const handleSelect = async (value) => {
    const without = labels.filter(l => l.type !== 'proficiency');
    await onUpdate([...without, { type: 'proficiency', value }]);
  };

  return (
    <div class="flex shrink-0">
      {LEVELS.map((level, i) => (
        <button
          key={level}
          onClick={() => handleSelect(level)}
          class={`text-xs px-2 py-1.5 cursor-pointer capitalize border border-gray-300 ${
            i === 0 ? 'rounded-l' : ''
          }${i === LEVELS.length - 1 ? 'rounded-r' : ''
          }${i > 0 ? ' -ml-px' : ''} ${
            current === level
              ? 'bg-blue-600 text-white border-blue-600 z-10 relative'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
