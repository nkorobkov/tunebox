import { useState } from 'preact/hooks';
import { getFileUrl, isAudio, isImage } from '../../hooks/use-attachments';
import { parseYouTube, shortYouTubeUrl } from '../../lib/youtube';
import { YouTubeEmbed } from '../common/youtube-embed';
import { useConnectivity } from '../../lib/connectivity';

const TYPE_LABELS = {
  sheet_music: 'Sheet music',
  recording: 'Recording',
  backing_track: 'Backing track',
  source: 'Source',
  other: 'Other',
};

const TYPE_OPTIONS = [
  { value: '', label: 'No type' },
  { value: 'sheet_music', label: 'Sheet music' },
  { value: 'recording', label: 'Recording' },
  { value: 'backing_track', label: 'Backing track' },
  { value: 'source', label: 'Source' },
  { value: 'other', label: 'Other' },
];

function AttachmentItem({ attachment, onDelete, onSetMainSource, onUpdate }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftType, setDraftType] = useState('');
  const [draftBpm, setDraftBpm] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const { isOffline } = useConnectivity();
  const isLink = !!attachment.url;
  const youtube = isLink ? parseYouTube(attachment.url) : null;
  const url = isLink ? attachment.url : getFileUrl(attachment);
  const filename = attachment.file;
  const audio = !isLink && isAudio(filename);
  const image = !isLink && isImage(filename);
  const displayUrl = isLink ? shortYouTubeUrl(attachment.url) : null;
  const displayName = attachment.label || filename || displayUrl;
  const isSheetMusic = attachment.type === 'sheet_music';

  // A video link can't serve as sheet music.
  const typeOptions = isLink ? TYPE_OPTIONS.filter(t => t.value !== 'sheet_music') : TYPE_OPTIONS;

  const draftUsesBpm = draftType === 'recording' || draftType === 'backing_track';

  const startEdit = () => {
    setDraftType(attachment.type || '');
    setDraftBpm(attachment.bpm > 0 ? String(attachment.bpm) : '');
    setEditing(true);
  };

  const handleEditSave = async () => {
    const data = { type: draftType };
    if (draftUsesBpm) data.bpm = draftBpm ? Number(draftBpm) : 0;
    // Leaving sheet_music invalidates the main-source designation.
    if (attachment.main_source && draftType !== 'sheet_music') data.main_source = false;
    setSavingEdit(true);
    try {
      await onUpdate(attachment.id, data);
      setEditing(false);
    } catch (err) {
      console.error('Failed to update attachment:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div class={`border rounded-md p-3 ${attachment.main_source ? 'border-brand-300 bg-brand-50' : 'border-gray-200'}`}>
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <div class="text-sm font-medium text-gray-800 truncate">
            {attachment.type ? (TYPE_LABELS[attachment.type] || attachment.type) : (isLink ? 'YouTube' : filename)}
            {attachment.label && attachment.type && ` (${attachment.label})`}
            {attachment.type === 'backing_track' && attachment.bpm > 0 && ` — ${attachment.bpm} BPM`}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            {attachment.type === 'recording' && attachment.bpm > 0 && <span>{attachment.bpm} BPM</span>}
            {attachment.main_source && <span class="text-brand-600 dark:text-brand-400 font-medium">Main source</span>}
            <span class="truncate">{isLink ? displayUrl : filename}</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {onUpdate && !editing && (
            <button
              onClick={startEdit}
              disabled={isOffline}
              class="text-xs text-gray-400 hover:text-blue-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={isOffline ? 'Unavailable offline' : 'Change type / BPM'}
            >
              edit
            </button>
          )}
          {isSheetMusic && onSetMainSource && (
            <button
              onClick={() => onSetMainSource(attachment.id, !attachment.main_source)}
              disabled={isOffline}
              class={`text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${attachment.main_source ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 hover:text-blue-600'}`}
              title={isOffline ? 'Unavailable offline' : (attachment.main_source ? 'Remove as main source' : 'Use as main sheet music')}
            >
              {attachment.main_source ? 'unset main' : 'set as main'}
            </button>
          )}
          {!isOffline && (isLink ? (
            <a
              href={url}
              target="_blank"
              rel="noopener"
              class="text-xs text-gray-400 hover:text-gray-600"
              title="Open on YouTube"
            >
              open
            </a>
          ) : (
            <a
              href={url}
              download={filename}
              class="text-xs text-gray-400 hover:text-gray-600"
              title="Download"
            >
              download
            </a>
          ))}
          {confirmDelete ? (
            <span class="flex items-center gap-1 text-xs">
              <button onClick={() => onDelete(attachment.id)} class="text-red-500 hover:underline cursor-pointer">delete</button>
              <button onClick={() => setConfirmDelete(false)} class="text-gray-400 hover:underline cursor-pointer">cancel</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isOffline}
              title={isOffline ? 'Unavailable offline' : undefined}
              class="text-xs text-gray-300 hover:text-red-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <select
            value={draftType}
            onChange={e => setDraftType(e.target.value)}
            class="border border-gray-300 rounded px-1.5 py-1 text-xs bg-white"
          >
            {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {draftUsesBpm && (
            <input
              type="number"
              value={draftBpm}
              onInput={e => setDraftBpm(e.target.value)}
              placeholder="BPM"
              min="1"
              max="400"
              class="w-20 border border-gray-300 rounded px-1.5 py-1 text-xs"
            />
          )}
          <button
            onClick={handleEditSave}
            disabled={savingEdit}
            class="text-xs text-blue-600 hover:underline cursor-pointer disabled:opacity-40"
          >
            save
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={savingEdit}
            class="text-xs text-gray-400 hover:underline cursor-pointer disabled:opacity-40"
          >
            cancel
          </button>
        </div>
      )}

      {isOffline ? (
        <p class="text-xs text-gray-400 italic mt-1">Unavailable offline</p>
      ) : (
        <>
          {audio && (
            <audio controls preload="none" class="w-full h-8 mt-1">
              <source src={url} />
            </audio>
          )}

          {image && (
            <a href={url} target="_blank" rel="noopener">
              <img src={url} alt={displayName} class="max-h-48 rounded mt-1" loading="lazy" />
            </a>
          )}

          {youtube && (
            <div class="mt-1 max-w-md">
              <YouTubeEmbed videoId={youtube.id} start={youtube.start} title={displayName} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AttachmentList({ attachments, onDelete, onSetMainSource, onUpdate }) {
  if (!attachments.length) return null;

  return (
    <div class="space-y-2">
      {attachments.map(a => (
        <AttachmentItem key={a.id} attachment={a} onDelete={onDelete} onSetMainSource={onSetMainSource} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
