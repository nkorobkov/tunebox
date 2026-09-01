import { instrumentProficiency } from '../../lib/practice-algorithm';

const STATE_CLASS = {
  playing: 'bg-brand-50 text-brand-700 dark:text-brand-400',
  learning: 'bg-yellow-50 text-yellow-600',
  'not started': 'bg-gray-100 text-gray-500',
};

/**
 * Where every tune in the set stands, on every instrument any of them
 * tracks. Read-only: tempos belong to a tune, so they're edited on the tune
 * page — the same way sheet music and attachments are. Grouping by
 * instrument puts the tempos that have to match on adjacent lines, which is
 * what decides whether the set can be played end to end.
 */
export function SetSkills({ tunes }) {
  const instruments = [...new Set(
    tunes.flatMap(t => Object.keys(t.instruments || {}))
  )].sort();

  if (instruments.length === 0) {
    return (
      <p class="text-sm text-gray-400">
        No instruments on these tunes yet — start one from a tune page.
      </p>
    );
  }

  return (
    <div class="space-y-4">
      {instruments.map(instrument => {
        const targets = new Set(
          tunes.map(t => t.instruments?.[instrument]?.target_tempo || 0).filter(Boolean)
        );
        return (
          <div key={instrument}>
            <div class="flex items-baseline gap-2 mb-1.5">
              <h4 class="text-sm font-medium text-gray-800">{instrument}</h4>
              {targets.size > 1 && <span class="text-xs text-amber-600">targets differ</span>}
            </div>
            <ul class="space-y-1">
              {tunes.map(tune => {
                const data = tune.instruments?.[instrument];
                const state = instrumentProficiency(tune, instrument) || 'not started';
                return (
                  <li key={tune.id} class="flex items-center justify-between gap-2 text-sm">
                    <a
                      href={`/tune/${tune.id}`}
                      class="text-gray-700 no-underline hover:text-blue-600 hover:underline truncate"
                    >
                      {tune.title}
                    </a>
                    <span class="flex items-center gap-2 shrink-0">
                      {data && (
                        <span class="text-xs text-gray-500" style="font-variant-numeric: tabular-nums">
                          {data.current_tempo || 0} / {data.target_tempo || 0} BPM
                        </span>
                      )}
                      <span class={`text-xs px-1.5 py-0.5 rounded ${STATE_CLASS[state]}`}>{state}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p class="text-xs text-gray-400">Tempos are set per tune — open a tune to change them.</p>
    </div>
  );
}
