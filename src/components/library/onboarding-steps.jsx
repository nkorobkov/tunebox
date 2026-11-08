import { Button } from '../common/button';

/**
 * Getting-started checklist on the library page. Progress is derived from the
 * tunes the library already loaded — no extra queries:
 *   1. a tune exists
 *   2. some tune has an instrument started (`instruments` has a key)
 *   3. some instrument has a recorded practice (`last_practiced` set)
 * Finished steps drop out; once all three are done nothing renders.
 */
export function onboardingStep(tunes) {
  if (tunes.length === 0) return 1;
  const insts = tunes.flatMap(t => Object.values(t.instruments || {}));
  if (insts.length === 0) return 2;
  if (!insts.some(d => d?.last_practiced)) return 3;
  return null;
}

const STEPS = [
  {
    title: 'Add tunes to your library',
    text: "Search for tunes you play, or add them from sheet music or a file.",
    action: { label: 'Add a tune', href: '/add' },
  },
  {
    title: 'Start learning a tune on an instrument',
    text: 'Pick your instrument and choose which tunes to start on.',
    action: { label: 'Start learning', href: '/practice' },
  },
  {
    title: 'Practice and raise the tempo',
    text: 'Rate each run-through; the tempo goes up as the tune gets comfortable.',
    action: { label: 'Practice', href: '/practice' },
  },
];

export function OnboardingSteps({ tunes }) {
  const step = onboardingStep(tunes);
  if (!step) return null;

  return (
    <div class={`bg-white rounded-lg border border-gray-200 p-5 ${step === 1 ? 'max-w-md mx-auto mt-8' : 'mb-4'}`}>
      <h2 class="text-base font-semibold text-gray-900">
        {step === 1 ? 'Start your tunebook' : 'Getting started'}
      </h2>
      <ol class="mt-3 space-y-4">
        {STEPS.map((s, i) => {
          const n = i + 1;
          if (n < step) return null;
          const current = n === step;
          return (
            <li key={n} class="flex gap-3">
              <span
                class={`flex items-center justify-center w-6 h-6 shrink-0 rounded-full text-xs font-semibold ${
                  current ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {n}
              </span>
              <div class="min-w-0">
                <p class={`text-sm font-medium ${current ? 'text-gray-900' : 'text-gray-500'}`}>{s.title}</p>
                <p class="text-sm text-gray-500 mt-0.5">{s.text}</p>
                {current && (
                  <Button size="sm" href={s.action.href} class="mt-2">{s.action.label}</Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
