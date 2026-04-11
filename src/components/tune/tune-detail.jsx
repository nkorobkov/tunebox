import { useState } from 'preact/hooks';
import { AbcViewer } from './abc-viewer';
import { AbcPlayer } from './abc-player';
import { TuneForm } from './tune-form';
import { LabelEditor } from './label-editor';
import { ProficiencyPicker } from './proficiency-picker';
import { AttachmentList } from './attachment-list';
import { AttachmentUpload } from './attachment-upload';
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
          {(tune.session_id > 0 || tune.session_url || (tune.source_url && tune.source_url.includes('thesession.org'))) && (
            <a
              href={tune.session_url || tune.source_url || `https://thesession.org/tunes/${tune.session_id}`}
              target="_blank"
              rel="noopener"
              class="text-sm text-blue-500 hover:underline mt-1 inline-block"
            >
              View on The Session{tune.session_id > 0 ? ` (#${tune.session_id})` : ''}
            </a>
          )}
          {tune.source_url && !tune.source_url.includes('thesession.org') && (
            <a
              href={tune.source_url}
              target="_blank"
              rel="noopener"
              class="text-sm text-blue-500 hover:underline mt-1 inline-block"
            >
              Source
            </a>
          )}
        </div>
        <div class="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            class="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tags, Set & Proficiency */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
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
          <ProficiencyPicker
            labels={tune.labels || []}
            onUpdate={(labels) => onUpdate({ labels })}
          />
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
          <button
            onClick={() => setShowUpload(true)}
            class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            + Add
          </button>
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
    </div>
  );
}
