export function TuneCard({ tune, inSet = false }) {
  const proficiencyLabel = tune.labels?.find(l => l.type === 'proficiency');
  const sessionId = tune.session_id > 0 ? tune.session_id : null;

  return (
    <a
      href={`/tune/${tune.id}`}
      class={`block bg-white p-4 hover:bg-gray-50 transition-all no-underline ${
        inSet ? '' : 'rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-base font-semibold text-gray-900 truncate">{tune.title}</h3>
          <div class="flex items-center gap-2 mt-1">
            {tune.type && (
              <span class="text-xs text-gray-500 capitalize">{tune.type}</span>
            )}
            {tune.setting_key && (
              <span class="text-xs text-gray-400">{tune.setting_key}</span>
            )}
            {sessionId && (
              <span class="text-xs text-blue-500">thesession #{sessionId}</span>
            )}
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          {(proficiencyLabel || !tune.labels?.some(l => l.type === 'proficiency')) && (
            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {proficiencyLabel?.value || 'want to learn'}
            </span>
          )}
          {tune.abc && (
            <span class="text-xs text-green-500">ABC</span>
          )}
          {tune.attachments?.length > 0 && (
            <span class="text-xs text-orange-500">{tune.attachments.length} file(s)</span>
          )}
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
