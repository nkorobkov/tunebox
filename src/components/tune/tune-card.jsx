const PROFICIENCY_COLORS = {
  'want to learn': 'bg-gray-100 text-gray-500',
  'learning': 'bg-yellow-50 text-yellow-600',
  'playing': 'bg-green-50 text-green-600',
  'retired': 'bg-gray-100 text-gray-400',
};

export function TuneCard({ tune, inSet = false }) {
  const proficiency = tune.labels?.find(l => l.type === 'proficiency')?.value || 'want to learn';
  const tags = (tune.labels || []).filter(l => l.type === 'tag');
  const instruments = Object.entries(tune.instruments || {});
  const isLearning = proficiency === 'learning';

  return (
    <a
      href={`/tune/${tune.id}`}
      class={`block bg-white p-4 hover:bg-gray-50 transition-all no-underline ${
        inSet ? '' : 'rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-gray-900 truncate">{tune.title}</h3>
          <div class="flex items-center gap-2 mt-0.5">
            {tune.type && (
              <span class="text-xs text-gray-500 capitalize">{tune.type}</span>
            )}
            {tune.setting_key && (
              <span class="text-xs text-gray-400">{tune.setting_key}</span>
            )}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          {tags.map((tag, i) => (
            <span key={i} class="text-xs text-gray-400">#{tag.value}</span>
          ))}
          {instruments.map(([name, data]) => (
            <span
              key={name}
              class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
            >
              {name}
              {isLearning && data.current_tempo > 0 && data.target_tempo > 0 && (
                <span class="ml-1 opacity-75">({data.current_tempo}/{data.target_tempo})</span>
              )}
            </span>
          ))}
          <span class={`text-xs px-2 py-0.5 rounded-full ${PROFICIENCY_COLORS[proficiency] || 'bg-gray-100 text-gray-500'}`}>
            {proficiency}
          </span>
        </div>
      </div>
    </a>
  );
}

export function SetGroup({ tunes }) {
  if (tunes.length === 1) {
    return <TuneCard tune={tunes[0]} />;
  }

  return (
    <div class="flex rounded-lg border border-gray-200 overflow-hidden">
      <div class="w-1 bg-blue-400 shrink-0" />
      <div class="flex-1 divide-y divide-gray-100">
        {tunes.map(tune => (
          <TuneCard key={tune.id} tune={tune} inSet />
        ))}
      </div>
    </div>
  );
}
