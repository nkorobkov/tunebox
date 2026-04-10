import { useState } from 'preact/hooks';
import { AbcViewer } from './abc-viewer';
import { AbcPlayer } from './abc-player';
import { TuneForm } from './tune-form';
import { LabelEditor } from './label-editor';
import { InstrumentProgress } from '../instruments/progress-tracker';
import { buildAbcString, getDefaultTempo } from '../../lib/abc-utils';

export function TuneDetail({ tune, onUpdate, onDelete, userInstruments }) {
  const [editing, setEditing] = useState(false);

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
          <div class="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {tune.type && <span class="capitalize">{tune.type}</span>}
            {tune.setting_key && <span>Key: {tune.setting_key}</span>}
            {tune.canonical_tempo > 0 && <span>{tune.canonical_tempo} BPM</span>}
            {tune.author && <span>by {tune.author}</span>}
          </div>
          {tune.session_id > 0 && (
            <a
              href={tune.session_url || `https://thesession.org/tunes/${tune.session_id}`}
              target="_blank"
              rel="noopener"
              class="text-sm text-blue-500 hover:underline mt-1 inline-block"
            >
              View on The Session (#{tune.session_id})
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

      {/* Labels */}
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-sm font-medium text-gray-700 mb-2">Labels</h3>
        <LabelEditor
          labels={tune.labels || []}
          onUpdate={(labels) => onUpdate({ labels })}
        />
      </div>

      {/* ABC Sheet Music */}
      {fullAbc && (
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Sheet Music</h3>
          <AbcViewer abc={fullAbc} />
          <div class="mt-3">
            <AbcPlayer abc={fullAbc} defaultTempo={tune.practice_tempo || tune.canonical_tempo || getDefaultTempo(tune.type)} />
          </div>
        </div>
      )}

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
