import { useState } from 'preact/hooks';
import {
  buildTitleList,
  buildTunebookTxt,
  buildArchive,
  downloadBlob,
  datedFilename,
} from '../../lib/export-utils';
import { generateTunebookPdf, printPdfBlob } from '../../lib/tunebook-pdf';

const FORMATS = [
  { value: 'titles', label: 'List of titles', desc: 'Plain text, one tune title per line.' },
  { value: 'tunebook', label: 'ABC tunebook', desc: 'All ABC notation concatenated into one .txt file.' },
  { value: 'archive', label: 'Full archive', desc: 'ZIP with a folder per tune: ABC, attachments and practice history.' },
  { value: 'pdf', label: 'PDF tunebook', desc: 'Sheet music PDF, laid out for printing.' },
];

/**
 * Dialog for bulk export (mode="export": pick a format) and
 * printing (mode="print": PDF options only).
 */
export function ExportDialog({ tunes, mode, onClose }) {
  const isPrint = mode === 'print';
  const [format, setFormat] = useState('pdf');
  const [includeIndex, setIncludeIndex] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [skipNoNotation, setSkipNoNotation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);

  const showPdfOptions = isPrint || format === 'pdf';

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const pdfOptions = { includeIndex, includeNotes, skipNoNotation };
      if (isPrint) {
        const blob = await generateTunebookPdf(tunes, pdfOptions, setProgress);
        printPdfBlob(blob);
      } else if (format === 'titles') {
        downloadBlob(
          new Blob([buildTitleList(tunes)], { type: 'text/plain' }),
          datedFilename('tunebox-titles', 'txt')
        );
      } else if (format === 'tunebook') {
        downloadBlob(
          new Blob([buildTunebookTxt(tunes)], { type: 'text/plain' }),
          datedFilename('tunebox-tunebook', 'txt')
        );
      } else if (format === 'archive') {
        const blob = await buildArchive(tunes, setProgress);
        downloadBlob(blob, datedFilename('tunebox-archive', 'zip'));
      } else if (format === 'pdf') {
        const blob = await generateTunebookPdf(tunes, pdfOptions, setProgress);
        downloadBlob(blob, datedFilename('tunebox-tunebook', 'pdf'));
      }
      onClose();
    } catch (err) {
      console.error(`Bulk ${mode} failed:`, err);
      setError(err.friendly ? err.message : `${isPrint ? 'Print' : 'Export'} failed. Please try again.`);
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <>
      <div class="fixed inset-0 bg-black/40 z-30" onClick={() => !busy && onClose()} />
      <div class="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 pointer-events-auto">
          <h3 class="text-base font-semibold text-gray-900">
            {isPrint ? 'Print' : 'Export'} {tunes.length} tune{tunes.length !== 1 ? 's' : ''}
          </h3>

          {!isPrint && (
            <div class="space-y-2">
              {FORMATS.map(f => (
                <label
                  key={f.value}
                  class={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer ${
                    format === f.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    disabled={busy}
                    class="mt-0.5"
                  />
                  <span>
                    <span class="block text-sm font-medium text-gray-800">{f.label}</span>
                    <span class="block text-xs text-gray-500">{f.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {showPdfOptions && (
            <div class={`space-y-2 ${isPrint ? '' : 'pl-1'}`}>
              <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeIndex}
                  onChange={e => setIncludeIndex(e.target.checked)}
                  disabled={busy}
                />
                Include index (tune titles with page numbers)
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={e => setIncludeNotes(e.target.checked)}
                  disabled={busy}
                />
                Include notes
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipNoNotation}
                  onChange={e => setSkipNoNotation(e.target.checked)}
                  disabled={busy}
                />
                Skip tunes without sheet music (no ABC or main attachment)
              </label>
            </div>
          )}

          {error && <p class="text-sm text-red-600">{error}</p>}

          <div class="flex items-center justify-between gap-3">
            <span class="text-xs text-gray-400 truncate">{busy ? progress : ''}</span>
            <div class="flex gap-3 shrink-0">
              <button
                onClick={onClose}
                disabled={busy}
                class="text-sm px-3 py-2 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={run}
                disabled={busy}
                class="text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Working...' : isPrint ? 'Print' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
