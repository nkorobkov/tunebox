import { useState, useMemo } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { useTunes } from '../hooks/use-tunes';

export function SetsPage() {
  const { tunes, loading } = useTunes();
  const [expandedSet, setExpandedSet] = useState(null);

  // Derive sets from labels with type "set"
  const sets = useMemo(() => {
    const setMap = new Map();
    for (const tune of tunes) {
      for (const label of (tune.labels || [])) {
        if (label.type === 'set') {
          if (!setMap.has(label.value)) {
            setMap.set(label.value, []);
          }
          setMap.get(label.value).push({
            tune,
            order: label.order || 0,
          });
        }
      }
    }
    // Sort tunes within each set by order
    const result = [];
    for (const [name, entries] of setMap) {
      entries.sort((a, b) => a.order - b.order);
      result.push({ name, tunes: entries.map(e => e.tune) });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [tunes]);

  return (
    <Shell>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Sets</h1>

      {loading ? (
        <p class="text-gray-400 text-center py-12">Loading...</p>
      ) : sets.length === 0 ? (
        <div class="text-center py-12">
          <p class="text-gray-400 mb-2">No sets yet.</p>
          <p class="text-sm text-gray-400">
            Add a "set" label to tunes on their detail page to group them into sets.
          </p>
        </div>
      ) : (
        <div class="space-y-3">
          {sets.map(set => (
            <div key={set.name} class="bg-white rounded-lg border border-gray-200">
              <div
                class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedSet(expandedSet === set.name ? null : set.name)}
              >
                <div>
                  <h3 class="font-medium text-gray-900">{set.name}</h3>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {set.tunes.length} tune{set.tunes.length !== 1 ? 's' : ''}
                    {' \u00b7 '}
                    {set.tunes.map(t => t.type).filter(Boolean).join(', ')}
                  </p>
                </div>
                <span class="text-gray-400 text-sm">{expandedSet === set.name ? '\u25B2' : '\u25BC'}</span>
              </div>

              {expandedSet === set.name && (
                <div class="border-t border-gray-200 p-4">
                  <ol class="space-y-2">
                    {set.tunes.map((tune, i) => (
                      <li key={tune.id} class="flex items-center gap-3">
                        <span class="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                        <a
                          href={`/tune/${tune.id}`}
                          class="text-sm text-gray-900 hover:text-blue-600 no-underline"
                        >
                          {tune.title}
                        </a>
                        <span class="text-xs text-gray-400 capitalize">{tune.type}</span>
                        {tune.setting_key && (
                          <span class="text-xs text-gray-400">{tune.setting_key}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
