import { useState } from 'preact/hooks';
import { getFileUrl, isAudio, isImage } from '../../hooks/use-attachments';

const TYPE_LABELS = {
  sheet_music: 'Sheet Music',
  recording: 'Recording',
  backing_track: 'Backing Track',
  other: 'Other',
};

function AttachmentItem({ attachment, onDelete, onSetMainSource }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const url = getFileUrl(attachment);
  const filename = attachment.file;
  const audio = isAudio(filename);
  const image = isImage(filename);
  const displayName = attachment.label || filename;
  const isSheetMusic = attachment.type === 'sheet_music';

  return (
    <div class={`border rounded-md p-3 ${attachment.main_source ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}>
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <div class="text-sm font-medium text-gray-800 truncate">
            {attachment.type ? (TYPE_LABELS[attachment.type] || attachment.type) : filename}
            {attachment.label && attachment.type && ` (${attachment.label})`}
            {attachment.type === 'backing_track' && attachment.bpm > 0 && ` — ${attachment.bpm} BPM`}
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
            {attachment.type === 'recording' && attachment.bpm > 0 && <span>{attachment.bpm} BPM</span>}
            {attachment.main_source && <span class="text-blue-500 font-medium">Main source</span>}
            <span class="truncate">{filename}</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          {isSheetMusic && onSetMainSource && (
            <button
              onClick={() => onSetMainSource(attachment.id, !attachment.main_source)}
              class={`text-xs cursor-pointer ${attachment.main_source ? 'text-blue-500 hover:text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}
              title={attachment.main_source ? 'Remove as main source' : 'Use as main sheet music'}
            >
              {attachment.main_source ? 'unset main' : 'set as main'}
            </button>
          )}
          <a
            href={url}
            download={filename}
            class="text-xs text-gray-400 hover:text-gray-600"
            title="Download"
          >
            download
          </a>
          {confirmDelete ? (
            <span class="flex items-center gap-1 text-xs">
              <button onClick={() => onDelete(attachment.id)} class="text-red-500 hover:underline cursor-pointer">delete</button>
              <button onClick={() => setConfirmDelete(false)} class="text-gray-400 hover:underline cursor-pointer">cancel</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              class="text-xs text-gray-300 hover:text-red-400 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      </div>

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
    </div>
  );
}

export function AttachmentList({ attachments, onDelete, onSetMainSource }) {
  if (!attachments.length) return null;

  return (
    <div class="space-y-2">
      {attachments.map(a => (
        <AttachmentItem key={a.id} attachment={a} onDelete={onDelete} onSetMainSource={onSetMainSource} />
      ))}
    </div>
  );
}
