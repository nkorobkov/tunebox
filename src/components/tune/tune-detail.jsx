import { useState } from 'preact/hooks';
import { AbcViewer } from './abc-viewer';
import { AbcPlayer } from './abc-player';
import { TuneForm } from './tune-form';
import { LabelEditor } from './label-editor';
import { ProficiencyPicker } from './proficiency-picker';
import { AttachmentList } from './attachment-list';
import { AttachmentUpload } from './attachment-upload';
import { AudioRecorder } from './audio-recorder';
import { SheetMusicViewer } from './sheet-music-viewer';
import { InstrumentProgress } from '../instruments/progress-tracker';
import { useAttachments } from '../../hooks/use-attachments';
import { buildAbcString, getDefaultTempo } from '../../lib/abc-utils';

export function TuneDetail({ tune, onUpdate, onDelete, userInstruments }) {
  const [editing, setEditing] = useState(false);
  const [confirmRemoveSet, setConfirmRemoveSet] = useState(false);
  const [addingSet, setAddingSet] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { attachments, loading: attachmentsLoading, upload, remove, setMainSource, mainSource } = useAttachments(tune.id);

  const setLabel = (tune.labels || []).find(l => l.type === 'set');

  const handleRemoveSet = async () => {
    const updated = (tune.labels || []).filter(l => l.type !== 'set');
    await onUpdate({ labels: updated });
    setConfirmRemoveSet(false);
  };

  const handleAddSet = async () => {
    if (!newSetName.trim()) return;
    const updated = [...(tune.labels || []).filter(l => l.type !== 'set'), { type: 'set', value: newSetName.trim(), order: 1 }];
    await onUpdate({ labels: updated });
    setNewSetName('');
    setAddingSet(false);
  };

  const fullAbc = tune.abc
    ? buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc)
    : null;

  const handleUpdate = async (data) => {
    await onUpdate(data);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-900">Edit Tune</h2>
          <button
            onClick={() => setEditing(false)}
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
        <TuneForm initial={tune} onSubmit={handleUpdate} submitLabel="Update" />
      </div>
    );
  }

  return (
    <div class="space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{tune.title}</h1>
          {setLabel && (
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-sm text-gray-400">
                part of <span class="text-gray-600 font-medium">{setLabel.value}</span> set
              </span>
              {confirmRemoveSet ? (
                <span class="flex items-center gap-1 text-xs">
                  <button onClick={handleRemoveSet} class="text-red-500 hover:underline cursor-pointer">remove</button>
                  <button onClick={() => setConfirmRemoveSet(false)} class="text-gray-400 hover:underline cursor-pointer">cancel</button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmRemoveSet(true)}
                  class="text-gray-300 hover:text-red-400 cursor-pointer text-xs leading-none"
                  title="Remove from set"
                >&times;</button>
              )}
            </div>
          )}
          <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {tune.type && <span class="capitalize">{tune.type}</span>}
            {tune.setting_key && <span>Key: {tune.setting_key}</span>}
            {tune.canonical_tempo > 0 && <span>{tune.canonical_tempo} BPM</span>}
            {tune.author && <span>by {tune.author}</span>}
          </div>
          <div class="mt-2 hidden lg:block">
            <LabelEditor
              labels={tune.labels || []}
              onUpdate={(labels) => onUpdate({ labels })}
              setLabel={setLabel}
              addingSet={addingSet}
              onStartAddSet={() => setAddingSet(true)}
              onCancelAddSet={() => { setAddingSet(false); setNewSetName(''); }}
              newSetName={newSetName}
              onSetNameInput={setNewSetName}
              onAddSet={handleAddSet}
            />
          </div>
        </div>
        <div class="flex flex-col items-end gap-2">
          <div class="flex gap-2">
            <a
              href={`/practice?tune=${tune.id}`}
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 no-underline"
            >
              Practice
            </a>
            <button
              onClick={() => setEditing(true)}
              class="px-2 lg:px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer flex items-center gap-1"
              title="Edit"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
              </svg>
              <span class="hidden lg:inline">Edit</span>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              class="px-2 lg:px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 cursor-pointer flex items-center gap-1"
              title="Delete"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              <span class="hidden lg:inline">Delete</span>
            </button>
          </div>
          <div class="hidden lg:block">
            <ProficiencyPicker
              labels={tune.labels || []}
              onUpdate={(labels) => onUpdate({ labels })}
            />
          </div>
        </div>
      </div>

      {/* Sheet Music */}
      {mainSource ? (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <SheetMusicViewer attachment={mainSource} />
          {fullAbc && (
            <div class="mt-3">
              <AbcPlayer abc={fullAbc} defaultTempo={tune.practice_tempo || tune.canonical_tempo || getDefaultTempo(tune.type)} />
            </div>
          )}
        </div>
      ) : fullAbc ? (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <AbcViewer abc={fullAbc} />
          <div class="mt-3">
            <AbcPlayer abc={fullAbc} defaultTempo={tune.practice_tempo || tune.canonical_tempo || getDefaultTempo(tune.type)} />
          </div>
        </div>
      ) : null}

      {/* Tags & Proficiency — mobile only, above instruments */}
      <div class="lg:hidden space-y-3">
        <ProficiencyPicker
          labels={tune.labels || []}
          onUpdate={(labels) => onUpdate({ labels })}
        />
        <LabelEditor
          labels={tune.labels || []}
          onUpdate={(labels) => onUpdate({ labels })}
          setLabel={setLabel}
          addingSet={addingSet}
          onStartAddSet={() => setAddingSet(true)}
          onCancelAddSet={() => { setAddingSet(false); setNewSetName(''); }}
          newSetName={newSetName}
          onSetNameInput={setNewSetName}
          onAddSet={handleAddSet}
        />
      </div>

      {/* Instrument Progress */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-medium text-gray-700 mb-3">Instrument Progress</h3>
        <InstrumentProgress
          instruments={tune.instruments || {}}
          userInstruments={userInstruments || []}
          onUpdate={(instruments) => onUpdate({ instruments })}
        />
      </div>

      {/* Notes */}
      {tune.notes && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Notes</h3>
          <div class="text-sm text-gray-600 prose" dangerouslySetInnerHTML={{ __html: tune.notes }} />
        </div>
      )}

      {/* Attachments */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-700">
            Attachments{attachments.length > 0 && ` (${attachments.length})`}
          </h3>
          <div class="flex items-center gap-2">
            <button
              onClick={() => setShowRecorder(true)}
              class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Record
            </button>
            <span class="text-gray-300">|</span>
            <button
              onClick={() => setShowUpload(true)}
              class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Add
            </button>
          </div>
        </div>
        {attachmentsLoading ? (
          <p class="text-sm text-gray-400">Loading...</p>
        ) : attachments.length === 0 ? (
          <p class="text-sm text-gray-400">No attachments yet.</p>
        ) : (
          <AttachmentList attachments={attachments} onDelete={remove} onSetMainSource={setMainSource} />
        )}
      </div>

      {showUpload && (
        <AttachmentUpload onUpload={upload} onClose={() => setShowUpload(false)} />
      )}

      {showRecorder && (
        <AudioRecorder onUpload={upload} onClose={() => setShowRecorder(false)} />
      )}

      {/* Practice info */}
      {tune.next_review && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Practice Schedule</h3>
          <div class="text-sm text-gray-500 space-y-1">
            <p>Next review: {new Date(tune.next_review).toLocaleDateString()}</p>
            <p>Interval: {tune.interval_days} day{tune.interval_days !== 1 ? 's' : ''}</p>
            <p>Streak: {tune.consecutive_correct}</p>
          </div>
        </div>
      )}

      {/* External links */}
      {(tune.session_id > 0 || tune.session_url || (tune.source_url && tune.source_url.includes('thesession.org'))) && (
        <a
          href={tune.session_url || tune.source_url || `https://thesession.org/tunes/${tune.session_id}`}
          target="_blank"
          rel="noopener"
          class="text-sm text-blue-500 hover:underline inline-block"
        >
          View on The Session{tune.session_id > 0 ? ` (#${tune.session_id})` : ''}
        </a>
      )}
      {tune.source_url && !tune.source_url.includes('thesession.org') && (
        <a
          href={tune.source_url}
          target="_blank"
          rel="noopener"
          class="text-sm text-blue-500 hover:underline inline-block"
        >
          Source
        </a>
      )}

      {confirmDelete && (
        <>
          <div class="fixed inset-0 bg-black/40 z-30" onClick={() => setConfirmDelete(false)} />
          <div class="fixed inset-0 z-40 flex items-center justify-center p-4">
            <div class="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
              <h3 class="text-base font-semibold text-gray-900">Delete {tune.title}?</h3>
              <p class="text-sm text-gray-600">
                This tune and all its practice history will be permanently removed from your collection.
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(false)}
                  class="text-sm px-3 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  class="text-sm px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
