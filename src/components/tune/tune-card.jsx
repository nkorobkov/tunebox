import { instrumentProficiency } from '../../lib/practice-algorithm';

export function TuneCard({ tune, inSet = false }) {
  const tags = (tune.labels || []).filter(l => l.type === 'tag');
  const instruments = Object.entries(tune.instruments || {});

  return (
    <a
      href={`/tune/${tune.id}`}
      class={`block bg-white p-3 lg:p-4 hover:bg-gray-50 transition-all no-underline overflow-hidden ${
        inSet ? '' : 'rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Desktop: single row */}
      <div class="hidden lg:flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-gray-900 truncate">{tune.title}</h3>
          <div class="flex items-center gap-2 mt-0.5">
            {tune.type && <span class="text-xs text-gray-500 capitalize">{tune.type}</span>}
            {tune.setting_key && <span class="text-xs text-gray-400">{tune.setting_key}</span>}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          {tags.map((tag, i) => (
            <span key={i} class="text-xs text-gray-400">#{tag.value}</span>
          ))}
          {instruments.map(([name, data]) => {
            const prof = instrumentProficiency(tune, name);
            const isPlaying = prof === 'playing';
            return (
              <span
                key={name}
                class={`text-xs px-1.5 py-0.5 rounded ${
                  isPlaying ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                }`}
              >
                {isPlaying ? 'Playing' : 'Learning'} on {name}
                {!isPlaying && data.current_tempo > 0 && data.target_tempo > 0 && (
                  <span class="ml-1 opacity-75">({data.current_tempo}/{data.target_tempo})</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked */}
      <div class="lg:hidden">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-900 truncate">{tune.title}</h3>
        </div>
        <div class="flex items-center gap-2 mt-0.5 flex-wrap">
          {tune.type && <span class="text-[11px] text-gray-500 capitalize">{tune.type}</span>}
          {tune.setting_key && <span class="text-[11px] text-gray-400">{tune.setting_key}</span>}
          {instruments.map(([name, data]) => {
            const prof = instrumentProficiency(tune, name);
            const isPlaying = prof === 'playing';
            return (
              <span
                key={name}
                class={`text-[11px] px-1 py-0.5 rounded ${
                  isPlaying ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                }`}
              >
                {isPlaying ? 'Playing' : 'Learning'} on {name}
                {!isPlaying && data.current_tempo > 0 && data.target_tempo > 0 && (
                  <span class="ml-0.5 opacity-75">({data.current_tempo}/{data.target_tempo})</span>
                )}
              </span>
            );
          })}
        </div>
        {tags.length > 0 && (
          <div class="flex items-center gap-1.5 mt-1">
            {tags.map((tag, i) => (
              <span key={i} class="text-[11px] text-gray-400">#{tag.value}</span>
            ))}
          </div>
        )}
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
