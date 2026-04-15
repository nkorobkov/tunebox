import { useState, useRef, useCallback, useMemo, useEffect } from 'preact/hooks';

export function AudioRecorder({ onUpload, onClose }) {
  const [state, setState] = useState('idle'); // idle | recording | stopped
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [label, setLabel] = useState('');
  const [bpm, setBpm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [blob, setBlob] = useState(null);

  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const blobUrl = useMemo(() => blob ? URL.createObjectURL(blob) : null, [blob]);
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const recorded = new Blob(chunks.current, { type: recorder.mimeType });
        setBlob(recorded);
        setState('stopped');
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else {
        setError(err.message || 'Could not access microphone');
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
  }, []);

  const handleDiscard = () => {
    setBlob(null);
    setDuration(0);
    setState('idle');
  };

  const handleSave = async () => {
    if (!blob) return;
    setUploading(true);
    setError('');
    try {
      const ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'm4a' : 'ogg';
      const file = new File([blob], `recording.${ext}`, { type: blob.type });
      await onUpload({
        file,
        type: 'recording',
        bpm: bpm ? Number(bpm) : undefined,
        label: label || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    clearInterval(timerRef.current);
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    onClose();
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleClose}>
      <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 class="text-lg font-medium text-gray-900 mb-4">Record Audio</h3>

        <div class="space-y-4">
          {state === 'idle' && (
            <div class="flex flex-col items-center gap-3 py-4">
              <button
                onClick={startRecording}
                class="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer"
                title="Start recording"
              >
                <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </button>
              <p class="text-sm text-gray-500">Tap to start recording</p>
            </div>
          )}

          {state === 'recording' && (
            <div class="flex flex-col items-center gap-3 py-4">
              <div class="flex items-center gap-2 text-red-500">
                <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span class="text-lg font-mono">{formatTime(duration)}</span>
              </div>
              <button
                onClick={stopRecording}
                class="w-16 h-16 rounded-full bg-gray-800 hover:bg-gray-900 text-white flex items-center justify-center cursor-pointer"
                title="Stop recording"
              >
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
              <p class="text-sm text-gray-500">Tap to stop</p>
            </div>
          )}

          {state === 'stopped' && (
            <>
              <div class="flex flex-col items-center gap-2">
                <span class="text-sm text-gray-500">Recorded {formatTime(duration)}</span>
                {blobUrl && <audio src={blobUrl} controls class="w-full" />}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={label}
                  onInput={e => setLabel(e.target.value)}
                  placeholder="e.g. Slow version"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

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
            </>
          )}

          {error && <p class="text-sm text-red-500">{error}</p>}

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              class="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            {state === 'stopped' && (
              <>
                <button
                  type="button"
                  onClick={handleDiscard}
                  class="px-3 py-1.5 text-sm border border-gray-300 text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={uploading}
                  class="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
                >
                  {uploading ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
