import { useState, useRef } from 'preact/hooks';
import { isAudio, isImage } from '../../hooks/use-attachments';
import { Button } from '../common/button';
import { Dialog } from '../common/dialog';

const TYPES = [
  { value: '', label: 'No type' },
  { value: 'sheet_music', label: 'Sheet music' },
  { value: 'recording', label: 'Recording' },
  { value: 'backing_track', label: 'Backing track' },
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

export function AttachmentUpload({ onUpload, onClose }) {
  const [file, setFile] = useState(null);
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

  const showBpm = type === 'recording' || type === 'backing_track';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload({
        file,
        type: type || undefined,
        bpm: bpm && showBpm ? Number(bpm) : undefined,
        label: label || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog title="Add attachment" onClose={onClose} closeDisabled={uploading}>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              ref={fileRef}
              type="file"
              onChange={handleFileChange}
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type (optional)</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
            </div>
          )}

          {error && <p class="text-sm text-red-500">{error}</p>}

          <div class="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!file || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
    </Dialog>
  );
}
