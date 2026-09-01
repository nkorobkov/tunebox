import { setHref } from '../../lib/sets';

function WarnIcon({ class: cls = 'w-4 h-4' }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Small marker for places that only mention a set in passing (the tune page
 * header). Links through to the set page, where the banner explains the fix.
 */
export function SetWarningBadge({ readiness, setName }) {
  if (!readiness || readiness.ready) return null;
  return (
    <a
      href={setHref(setName)}
      title={`${readiness.reason} Practised tune by tune until then.`}
      aria-label={readiness.reason}
      class="inline-flex items-center text-amber-600 hover:text-amber-700 no-underline shrink-0"
    >
      <WarnIcon class="w-3.5 h-3.5" />
    </a>
  );
}

/** Full explanation on the set page. */
export function SetWarningBanner({ readiness, instrument }) {
  if (!readiness || readiness.ready) return null;
  return (
    <div class="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
      <span class="text-amber-500 mt-0.5"><WarnIcon /></span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-amber-800">Not ready to practise as one set</p>
        <p class="text-sm text-amber-700 mt-0.5">{readiness.reason}</p>
        {readiness.notReady.length > 0 && (
          <ul class="mt-1.5 space-y-0.5">
            {readiness.notReady.map(tune => (
              <li key={tune.id} class="text-xs text-amber-700">
                <a href={`/tune/${tune.id}`} class="text-amber-800 hover:underline no-underline">{tune.title}</a>
                {' — '}
                {tune.instruments?.[instrument]
                  ? `${tune.instruments[instrument].current_tempo || 0}/${tune.instruments[instrument].target_tempo || 0} BPM`
                  : `not started on ${instrument}`}
              </li>
            ))}
          </ul>
        )}
        <p class="text-xs text-amber-600 mt-1.5">
          Its tunes still show up individually in practice.
        </p>
      </div>
    </div>
  );
}
