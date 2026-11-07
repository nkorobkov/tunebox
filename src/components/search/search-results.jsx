import { useState } from 'preact/hooks';
import { getTune } from '../../lib/session-api';
import { useConnectivity } from '../../lib/connectivity';
import { buildAbcString, getDefaultTempo } from '../../lib/abc-utils';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';

// A user_tunes record for one thesession.org setting of a tune.
export function sessionTuneRecord(tune, setting) {
  return {
    title: tune.name,
    type: tune.type,
    abc: buildAbcString(tune.name, tune.type, setting.key, setting.abc),
    session_id: tune.id,
    session_url: tune.url || `https://thesession.org/tunes/${tune.id}`,
    setting_key: setting.key,
    canonical_tempo: getDefaultTempo(tune.type),
    labels: [],
    instruments: {},
  };
}

// `quickAdd` (optional): { status(id) → 'added' | 'adding' | 'failed' | null,
// href(id) → link to the library copy or null, add(tune) } — gives each row a
// one-click "Add" button (first setting) beside the expand-to-preview row.
export function SearchResults({ results, onImport, quickAdd }) {
  const [expandedId, setExpandedId] = useState(null);
  const [tuneDetail, setTuneDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState(0);
  const [importing, setImporting] = useState(null);
  const { isOffline } = useConnectivity();

  const handleExpand = async (tuneId) => {
    if (expandedId === tuneId) {
      setExpandedId(null);
      setTuneDetail(null);
      return;
    }

    setExpandedId(tuneId);
    setLoadingDetail(true);
    setSelectedSetting(0);
    try {
      const detail = await getTune(tuneId);
      setTuneDetail(detail);
    } catch (err) {
      console.error('Failed to load tune details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleImport = async (tune, setting) => {
    setImporting(tune.id);
    try {
      await onImport(sessionTuneRecord(tune, setting));
    } finally {
      setImporting(null);
    }
  };

  return (
    <div class="space-y-2">
      {results.map(tune => (
        <div key={tune.id} class="bg-white rounded-lg border border-gray-200">
          <div
            class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
            onClick={() => handleExpand(tune.id)}
          >
            <div>
              <span class="font-medium text-gray-900">{tune.name}</span>
              <span class="ml-2 text-xs text-gray-500 capitalize">{tune.type}</span>
              {tune.alias && tune.alias !== tune.name && (
                <span class="ml-2 text-xs text-gray-400">aka {tune.alias}</span>
              )}
            </div>
            {quickAdd ? (
              <QuickAddButton tune={tune} quickAdd={quickAdd} disabled={isOffline} />
            ) : (
              <span class="text-xs text-gray-400">#{tune.id}</span>
            )}
          </div>

          {expandedId === tune.id && (
            <div class="border-t border-gray-200 p-4">
              {loadingDetail ? (
                <p class="text-sm text-gray-400">Loading settings...</p>
              ) : tuneDetail ? (
                <div class="space-y-3">
                  {/* Setting selector */}
                  {tuneDetail.settings.length > 1 && (
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-gray-500">Setting:</label>
                      <select
                        value={selectedSetting}
                        onChange={e => setSelectedSetting(Number(e.target.value))}
                        class="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        {tuneDetail.settings.map((s, i) => (
                          <option key={i} value={i}>
                            #{i + 1} — {s.key}
                          </option>
                        ))}
                      </select>
                      <span class="text-xs text-gray-400">
                        {tuneDetail.settings.length} settings available
                      </span>
                    </div>
                  )}

                  {/* ABC Preview + Player */}
                  {tuneDetail.settings[selectedSetting] && (() => {
                    const abc = buildAbcString(
                      tuneDetail.name,
                      tuneDetail.type,
                      tuneDetail.settings[selectedSetting].key,
                      tuneDetail.settings[selectedSetting].abc
                    );
                    return (
                      <div class="bg-gray-50 rounded p-3 space-y-3">
                        <AbcViewer abc={abc} />
                        <AbcPlayer abc={abc} defaultTempo={getDefaultTempo(tuneDetail.type)} />
                      </div>
                    );
                  })()}

                  {/* Import button */}
                  <button
                    onClick={() => handleImport(tuneDetail, tuneDetail.settings[selectedSetting])}
                    disabled={importing === tune.id || isOffline}
                    title={isOffline ? 'Unavailable offline' : undefined}
                    class="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50 cursor-pointer"
                  >
                    {importing === tune.id ? 'Adding...' : 'Add to My Collection'}
                  </button>
                </div>
              ) : (
                <p class="text-sm text-red-500">Failed to load tune details.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QuickAddButton({ tune, quickAdd, disabled }) {
  const status = quickAdd.status(tune.id);
  const href = quickAdd.href(tune.id);
  const stop = (e) => e.stopPropagation();
  if (status === 'added' || href) {
    return href ? (
      <a href={href} onClick={stop} class="shrink-0 ml-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
        In library
      </a>
    ) : (
      <span class="shrink-0 ml-3 text-sm text-gray-400">Added</span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { stop(e); quickAdd.add(tune); }}
      disabled={disabled || status === 'adding'}
      title={disabled ? 'Unavailable offline' : 'Add the first setting to your library'}
      class="shrink-0 ml-3 px-3 py-1 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 cursor-pointer"
    >
      {status === 'adding' ? 'Adding…' : status === 'failed' ? 'Retry' : '+ Add'}
    </button>
  );
}
