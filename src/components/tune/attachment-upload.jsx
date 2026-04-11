import { useState, useRef } from 'preact/hooks';
import { isAudio, isImage } from '../../hooks/use-attachments';

const TYPES = [
  { value: '', label: 'No type' },
  { value: 'sheet_music', label: 'Sheet Music' },
  { value: 'recording', label: 'Recording' },
  { value: 'backing_track', label: 'Backing Track' },
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
    if (f) {
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
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 class="text-lg font-medium text-gray-900 mb-4">Add Attachment</h3>
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
            <button
              type="button"
              onClick={onClose}
              class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              class="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
