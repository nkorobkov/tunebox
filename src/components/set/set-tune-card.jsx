import { useState } from 'preact/hooks';
import { AbcViewer } from '../tune/abc-viewer';
import { AbcPlayer } from '../tune/abc-player';
import { SheetMusicViewer } from '../tune/sheet-music-viewer';
import { AttachmentList } from '../tune/attachment-list';
import { useAttachments } from '../../hooks/use-attachments';
import { useConnectivity } from '../../lib/connectivity';
import { buildAbcString, getDefaultTempo } from '../../lib/abc-utils';
import { instrumentProficiency } from '../../lib/practice-algorithm';

/**
 * One member of a set, shown with everything attached to it: its notation
 * and its own attachments. Position controls live here because a set is
 * played in order.
 */
export function SetTuneCard({ tune, position, instrument, canMoveUp, canMoveDown, onMove, onRemove, busy }) {
  const { attachments, loading, upload: _upload, update, remove, setMainSource, mainSource } = useAttachments(tune.id);
  const { isOffline } = useConnectivity();
  const [transpose, setTranspose] = useState(tune.transpose || 0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const fullAbc = tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null;
  const tempo = tune.instruments?.[instrument]?.target_tempo
    || tune.practice_tempo || tune.canonical_tempo || getDefaultTempo(tune.type);

  const prof = instrumentProficiency(tune, instrument);
  const data = tune.instruments?.[instrument];

  return (
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="flex items-start justify-between gap-3 p-4 pb-3">
        <div class="flex items-start gap-3 min-w-0">
          <span class="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-brand-50 text-brand-700 dark:text-brand-400 text-xs font-semibold flex items-center justify-center">
            {position}
          </span>
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900 truncate">
              <a href={`/tune/${tune.id}`} class="no-underline text-gray-900 hover:text-blue-600">{tune.title}</a>
            </h3>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-500">
              {tune.type && <span class="capitalize">{tune.type}</span>}
              {tune.setting_key && <span class="text-gray-400">{tune.setting_key}</span>}
              {instrument && (
                <span class={`px-1.5 py-0.5 rounded ${
                  prof === 'playing'
                    ? 'bg-brand-50 text-brand-700 dark:text-brand-400'
                    : prof === 'learning' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {prof === 'playing' ? 'Playing' : prof === 'learning' ? 'Learning' : 'Not started'} on {instrument}
                  {prof === 'learning' && data?.target_tempo > 0 && (
                    <span class="ml-1 opacity-75">({data.current_tempo || 0}/{data.target_tempo})</span>
                  )}
                  {prof === 'playing' && data?.target_tempo > 0 && (
                    <span class="ml-1 opacity-75">({data.target_tempo} BPM)</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onMove(-1)}
            disabled={!canMoveUp || busy || isOffline}
            aria-label="Move earlier in the set"
            title="Move earlier in the set"
            class="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >↑</button>
          <button
            onClick={() => onMove(1)}
            disabled={!canMoveDown || busy || isOffline}
            aria-label="Move later in the set"
            title="Move later in the set"
            class="w-6 h-6 flex items-center justify-center rounded border border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >↓</button>
          {confirmRemove ? (
            <span class="flex items-center gap-1 text-xs">
              <button onClick={() => { setConfirmRemove(false); onRemove(); }} class="text-red-500 hover:underline cursor-pointer">remove</button>
              <button onClick={() => setConfirmRemove(false)} class="text-gray-400 hover:underline cursor-pointer">cancel</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={busy || isOffline}
              title={isOffline ? 'Unavailable offline' : 'Remove from set'}
              class="text-gray-300 hover:text-red-400 cursor-pointer text-sm leading-none px-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >&times;</button>
          )}
        </div>
      </div>

      {/* Notation */}
      {mainSource ? (
        <div class="px-4 pb-3">
          <SheetMusicViewer attachment={mainSource} />
          {fullAbc && <div class="mt-3"><AbcPlayer abc={fullAbc} defaultTempo={tempo} transpose={transpose} /></div>}
        </div>
      ) : fullAbc ? (
        <div class="px-4 pb-3">
          <AbcViewer abc={fullAbc} transpose={transpose} onTransposeChange={setTranspose} />
          <div class="mt-3"><AbcPlayer abc={fullAbc} defaultTempo={tempo} transpose={transpose} /></div>
        </div>
      ) : (
        <p class="px-4 pb-3 text-sm text-gray-400">No notation for this tune.</p>
      )}

      {/* The tune's own attachments — set-level assets live above this list */}
      <div class="border-t border-gray-100 px-4 py-3">
        {loading ? (
          <p class="text-sm text-gray-400">Loading attachments...</p>
        ) : attachments.length === 0 ? (
          <p class="text-sm text-gray-400">
            No attachments. <a href={`/tune/${tune.id}`} class="text-blue-600 hover:underline">Add one on the tune page</a>.
          </p>
        ) : (
          <>
            <h4 class="text-xs font-medium text-gray-500 mb-2">Tune attachments ({attachments.length})</h4>
            <AttachmentList
              attachments={attachments}
              onDelete={remove}
              onSetMainSource={setMainSource}
              onUpdate={update}
            />
          </>
        )}
      </div>
    </div>
  );
}
