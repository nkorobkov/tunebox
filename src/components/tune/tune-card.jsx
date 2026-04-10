export function TuneCard({ tune }) {
  const categoryLabel = tune.labels?.find(l => l.type === 'category');

  return (
    <a
      href={`/tune/${tune.id}`}
      class="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all no-underline"
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
            {tune.session_id && (
              <span class="text-xs text-blue-500">thesession #{tune.session_id}</span>
            )}
          </div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          {categoryLabel && (
            <span class="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {categoryLabel.value}
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
