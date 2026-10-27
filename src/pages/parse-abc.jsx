import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../lib/auth';
import { Shell } from '../components/layout/shell';
import { Button } from '../components/common/button';
import { AbcViewer } from '../components/tune/abc-viewer';
import { AbcPlayer } from '../components/tune/abc-player';
import { Turnstile } from '../components/parse/turnstile';
import { recognizeImage, getQuota, OmrError, TURNSTILE_SITE_KEY } from '../lib/omr-api';
import { isPdfFile, renderPdfPage } from '../lib/pdf-import';

// Formats the recognition service takes as-is; anything else the browser can decode
// (e.g. HEIC photos in Safari) is converted to JPEG first.
const DIRECT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

async function toUploadable(file) {
  if (DIRECT_TYPES.includes(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new OmrError('unsupported', 'This file type isn’t supported. Use a PNG, JPEG or PDF.');
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

function useObjectUrl(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function progressText(phase, job, seconds) {
  if (phase === 'preparing') return 'Preparing the image…';
  if (phase === 'uploading') return 'Uploading…';
  if (job?.status === 'queued') {
    return job.queue_position > 1 ? `Waiting in line (${job.queue_position - 1} ahead of you)…` : 'Starting…';
  }
  return `Reading the music… ${seconds}s (usually under a minute)`;
}

function QuotaLine({ quota, signedIn, onSignIn }) {
  if (!quota) return null;
  if (signedIn) {
    return (
      <p class="text-sm text-gray-500">
        {quota.remaining_today} of {quota.per_day} conversions left today.
      </p>
    );
  }
  return (
    <p class="text-sm text-gray-500">
      {quota.remaining_today} of {quota.per_day} free conversions left today ·{' '}
      <button onClick={onSignIn} class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
        sign in
      </button>{' '}for more
    </p>
  );
}

function PublicHeader({ onSignIn }) {
  return (
    <header class="sticky top-0 z-20 bg-gray-50/80 backdrop-blur border-b border-gray-200">
      <div class="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/"><img src="/tunebook.svg" alt="TuneBox" class="h-7" /></a>
        <Button variant="secondary" onClick={onSignIn}>Sign in</Button>
      </div>
    </header>
  );
}

function ParseAbc() {
  const { user, loginWithGoogle } = useAuth();
  const signedIn = !!user;
  const [file, setFile] = useState(null);          // what the user picked
  const [image, setImage] = useState(null);        // what gets uploaded (PDF page rendered)
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [phase, setPhase] = useState('idle');      // idle | preparing | uploading | working | done
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [abc, setAbc] = useState('');
  const [quota, setQuota] = useState(null);
  const [token, setToken] = useState(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const preview = useObjectUrl(image);
  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'working';
  const anonymousOff = !signedIn && !TURNSTILE_SITE_KEY;

  const refreshQuota = useCallback(() => {
    getQuota().then(setQuota).catch(() => setQuota(null));
  }, []);
  useEffect(() => { if (!anonymousOff) refreshQuota(); }, [signedIn, anonymousOff, refreshQuota]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== 'working') return;
    const start = Date.now();
    setSeconds(0);
    const t = setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const signIn = async () => {
    try { await loginWithGoogle(); } catch { setError('Sign-in failed. Please try again.'); }
  };

  const pick = async (picked, page = 1) => {
    if (!picked) return;
    setError(''); setJob(null); setAbc(''); setFile(picked); setImage(null);
    setPhase('preparing');
    try {
      if (isPdfFile(picked)) {
        const { blob, pages } = await renderPdfPage(picked, page);
        setPdfPages(pages); setPdfPage(Math.min(page, pages)); setImage(blob);
      } else {
        setPdfPages(0); setImage(await toUploadable(picked));
      }
      setPhase('idle');
    } catch (err) {
      setError(err instanceof OmrError ? err.message : 'Couldn’t open this file.');
      setPhase('idle');
    }
  };

  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) pick(item.getAsFile());
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const convert = async () => {
    if (!image) return;
    setError(''); setJob(null); setAbc(''); setPhase('uploading');
    const controller = new AbortController();
    abortRef.current = controller;
    const name = (file?.name || 'score').replace(/\.[^.]+$/, '') + (image.type === 'image/png' ? '.png' : '.jpg');
    try {
      const result = await recognizeImage(image, name, {
        turnstileToken: signedIn ? undefined : token,
        signal: controller.signal,
        onProgress: (j) => { setJob(j); setPhase('working'); },
      });
      setJob(result);
      if (result.status === 'done') {
        setAbc(result.abc);
      } else {
        setError(result.error?.code === 'no_music_found'
          ? 'No sheet music was found in this image. Try a sharper, straighter photo of the page.'
          : result.error?.message || 'The conversion failed.');
      }
      setPhase('done');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err instanceof OmrError ? err.message : 'The conversion failed. Try again.');
      setPhase('idle');
    } finally {
      // Bot-check tokens are single use
      if (!signedIn) setTurnstileReset((n) => n + 1);
      refreshQuota();
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(abc);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([abc], { type: 'text/vnd.abc' }));
    a.download = (file?.name || 'tune').replace(/\.[^.]+$/, '') + '.abc';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const outOfQuota = quota && quota.remaining_today === 0;
  const canConvert = image && !busy && !outOfQuota && (signedIn || token);

  return (
    <div class="max-w-3xl space-y-5">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Sheet music to ABC</h1>
        <p class="mt-1 text-sm text-gray-600">
          Upload a photo, scan or PDF of a tune and get it back as ABC notation, chord symbols
          included, ready to play, edit or copy. Works best on a single melody line, the way trad
          tunes are usually written.
        </p>
      </div>

      {anonymousOff ? (
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
          <button onClick={signIn} class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">Sign in</button>{' '}
          to convert sheet music.
        </div>
      ) : (
        <>
          <QuotaLine quota={quota} signedIn={signedIn} onSignIn={signIn} />

          <div
            class="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-brand-600 p-6 text-center cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
          >
            <input ref={inputRef} type="file" accept="image/*,.pdf,application/pdf" class="hidden"
              onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
            <p class="text-sm text-gray-700">
              {file ? file.name : 'Drop a picture or PDF here, click to choose, or paste'}
            </p>
            <p class="text-xs text-gray-400 mt-1">PNG, JPEG or PDF · one page at a time</p>
          </div>

          {pdfPages > 1 && (
            <label class="flex items-center gap-2 text-sm text-gray-600">
              Page
              <select
                value={pdfPage}
                disabled={busy}
                onChange={(e) => pick(file, Number(e.target.value))}
                class="border border-gray-300 rounded-md px-2 py-1 bg-white"
              >
                {Array.from({ length: pdfPages }, (_, i) => <option value={i + 1}>{i + 1}</option>)}
              </select>
              of {pdfPages}
            </label>
          )}

          {preview && (
            <img src={preview} alt="The page to convert" class="max-h-80 rounded border border-gray-200 bg-white" />
          )}

          {!signedIn && image && (
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onToken={setToken}
              resetKey={turnstileReset}
              onError={() => setError('The bot check couldn’t load. Disable content blockers for this page, or sign in.')}
            />
          )}

          <div class="flex items-center gap-3 flex-wrap">
            <Button size="md" onClick={convert} disabled={!canConvert}>Convert to ABC</Button>
            {busy && <span class="text-sm text-gray-500">{progressText(phase, job, seconds)}</span>}
            {outOfQuota && !busy && (
              <span class="text-sm text-amber-600">
                {signedIn ? 'You’ve used today’s conversions. More tomorrow.' : 'You’ve used today’s free conversions.'}
              </span>
            )}
          </div>
        </>
      )}

      {error && <p class="text-sm text-red-600">{error}</p>}

      {abc && (
        <div class="space-y-4">
          {job?.warnings?.length > 0 && (
            <p class="text-xs text-amber-600">
              Some parts may be off — check the chords and repeats against the original.
            </p>
          )}
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <AbcViewer abc={abc} />
          </div>
          <AbcPlayer abc={abc} />
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="abc-text" class="text-sm font-medium text-gray-700">ABC (you can edit it)</label>
              <div class="flex gap-2">
                <Button variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
                <Button variant="secondary" onClick={download}>Download .abc</Button>
              </div>
            </div>
            <textarea
              id="abc-text"
              value={abc}
              onInput={(e) => setAbc(e.target.value)}
              spellcheck={false}
              rows={10}
              class="w-full font-mono text-xs border border-gray-300 rounded-md p-3 bg-white text-gray-800"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ParseAbcPage() {
  const { user, loginWithGoogle } = useAuth();
  if (user) {
    return <Shell><ParseAbc /></Shell>;
  }
  return (
    <div class="min-h-screen bg-gray-50">
      <PublicHeader onSignIn={() => loginWithGoogle().catch(() => {})} />
      <main class="max-w-5xl mx-auto px-4 py-6">
        <ParseAbc />
      </main>
    </div>
  );
}
