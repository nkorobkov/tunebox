import { useState, useRef } from 'preact/hooks';
import { isAudio, isImage } from '../../hooks/use-attachments';
import { isYouTubeUrl } from '../../lib/youtube';
import { Button } from '../common/button';
import { Dialog } from '../common/dialog';

const FILE_TYPES = [
  { value: '', label: 'No type' },
  { value: 'sheet_music', label: 'Sheet music' },
  { value: 'recording', label: 'Recording' },
  { value: 'backing_track', label: 'Backing track' },
  { value: 'other', label: 'Other' },
];

// Links can't be sheet music, but can be a source/reference.
const LINK_TYPES = [
  { value: '', label: 'No type' },
  { value: 'recording', label: 'Recording' },
  { value: 'backing_track', label: 'Backing track' },
  { value: 'source', label: 'Source / reference' },
  { value: 'other', label: 'Other' },
];

function isPdf(name) {
  return /\.pdf$/i.test(name);
}

function autoDetectType(filename) {
  if (isAudio(filename)) return 'recording';
  if (isImage(filename) || isPdf(filename)) return 'sheet_music';
  return '';
}

export function AttachmentUpload({ onUpload, onClose, initialUrl = '' }) {
  const [mode, setMode] = useState(initialUrl ? 'link' : 'file');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(initialUrl);
  const [type, setType] = useState('');
  const [bpm, setBpm] = useState('');
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    // Only auto-detect when the user hasn't already chosen a type — don't
    // clobber an explicit selection (e.g. "Backing Track") on file pick.
    if (f && !type) {
      const detected = autoDetectType(f.name);
      if (detected) setType(detected);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setError('');
    // sheet_music isn't valid for links
    if (m === 'link' && type === 'sheet_music') setType('');
  };

  const isLink = mode === 'link';
  const types = isLink ? LINK_TYPES : FILE_TYPES;
  const showBpm = type === 'recording' || type === 'backing_track';
  const urlValid = isYouTubeUrl(url.trim());
  const canSubmit = isLink ? urlValid : !!file;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setUploading(true);
    setError('');
    try {
      await onUpload({
        file: isLink ? undefined : file,
        url: isLink ? url.trim() : undefined,
        type: type || undefined,
        bpm: bpm && showBpm ? Number(bpm) : undefined,
        label: label || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || (isLink ? 'Failed to add link' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog title="Add attachment" onClose={onClose} closeDisabled={uploading}>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="flex rounded-md border border-gray-300 overflow-hidden text-sm">
            {[['file', 'File'], ['link', 'YouTube link']].map(([m, lbl]) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                class={`flex-1 py-2 cursor-pointer ${mode === m ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {isLink ? (
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">YouTube URL</label>
              <input
                type="url"
                value={url}
                onInput={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              {url.trim() && !urlValid && (
                <p class="text-xs text-amber-600 mt-1">Doesn't look like a YouTube video link.</p>
              )}
            </div>
          ) : (
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">File</label>
              <input
                ref={fileRef}
                type="file"
                onChange={handleFileChange}
                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
              />
            </div>
          )}

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type (optional)</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
            <input
              type="text"
              value={label}
              onInput={e => setLabel(e.target.value)}
              placeholder="e.g. Slow version, Page 2..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {showBpm && (
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">BPM (optional)</label>
              <input
                type="number"
                value={bpm}
                onInput={e => setBpm(e.target.value)}
                placeholder="e.g. 120"
                min="1"
                max="400"
                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              {isLink && (
                <p class="text-xs text-gray-400 mt-1">Shown next to the video during practice.</p>
              )}
            </div>
          )}

          {error && <p class="text-sm text-red-500">{error}</p>}

          <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || uploading}>
              {uploading ? 'Saving...' : (isLink ? 'Add link' : 'Upload')}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
