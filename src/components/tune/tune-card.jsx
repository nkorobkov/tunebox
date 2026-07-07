import { instrumentProficiency } from '../../lib/practice-algorithm';

export function TuneCard({ tune, inSet = false, selectable = false, selected = false, onToggleSelect }) {
  const tags = (tune.labels || []).filter(l => l.type === 'tag');
  const instruments = Object.entries(tune.instruments || {});

  const Wrapper = selectable ? 'div' : 'a';
  const selectedClass = selected
    ? (inSet ? 'bg-blue-50' : 'border-blue-400 ring-1 ring-blue-400')
    : '';

  return (
    <Wrapper
      href={selectable ? undefined : `/tune/${tune.id}`}
      onClick={selectable ? () => onToggleSelect(tune.id) : undefined}
      class={`block bg-white p-3 lg:p-4 hover:bg-gray-50 transition-all no-underline overflow-hidden ${
        inSet ? '' : 'rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm'
      } ${selectable ? 'cursor-pointer select-none' : ''} ${selectedClass}`}
    >
      <div class="flex items-center gap-3">
        {selectable && (
          <span
            class={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
              selected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
            }`}
          >
            {selected && (
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        )}
        <div class="flex-1 min-w-0">
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
                  isPlaying ? 'bg-brand-50 text-brand-700' : 'bg-yellow-50 text-yellow-600'
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
                  isPlaying ? 'bg-brand-50 text-brand-700' : 'bg-yellow-50 text-yellow-600'
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
        </div>
      </div>
    </Wrapper>
  );
}

export function SetGroup({ tunes, selectable = false, selectedIds, onToggleSelect }) {
  const selectionProps = (tune) => ({
    selectable,
    selected: selectable && selectedIds?.has(tune.id),
    onToggleSelect,
  });

  if (tunes.length === 1) {
    return <TuneCard tune={tunes[0]} {...selectionProps(tunes[0])} />;
  }

  return (
    <div class="flex rounded-lg border border-gray-200 overflow-hidden">
      <div class="w-1 bg-brand-400 shrink-0" />
      <div class="flex-1 divide-y divide-gray-100">
        {tunes.map(tune => (
          <TuneCard key={tune.id} tune={tune} inSet {...selectionProps(tune)} />
        ))}
      </div>
    </div>
  );
}
