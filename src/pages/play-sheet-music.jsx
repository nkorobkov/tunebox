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

const INTRO = 'Snap or upload a page of printed music and hear how the tune goes, chords and all. '
  + 'TuneBox reads the notes, plays them back at any speed, and gives you the tune as notation '
  + 'you can edit, copy and save.';

// The scanner itself; the page around it differs for signed-in users (app shell) and
// visitors (standalone page in the style of /collections/, prerendered for search engines).
function Scanner() {
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
  const [transpose, setTranspose] = useState(0);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const preview = useObjectUrl(image);
  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'working';
  const visitorsOff = !signedIn && !TURNSTILE_SITE_KEY;

  const refreshQuota = useCallback(() => {
    getQuota().then(setQuota).catch(() => setQuota(null));
  }, []);
  useEffect(() => { if (!visitorsOff) refreshQuota(); }, [signedIn, visitorsOff, refreshQuota]);
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
    setError(''); setJob(null); setAbc(''); setTranspose(0); setFile(picked); setImage(null);
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

  const atLimit = quota && quota.remaining_today === 0;
  const canConvert = image && !busy && !atLimit && (signedIn || token);
  // Only shown to signed-out visitors, on the standalone page: links styled like /collections/
  const signInLink = (text) => (
    <button onClick={signIn} class="text-brand-700 underline hover:text-brand-800 cursor-pointer">{text}</button>
  );

  if (visitorsOff) {
    return (
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
        {signInLink('Sign in')} to scan sheet music.
      </div>
    );
  }

  return (
    <div class="space-y-5">
      {/* Signed-in users aren't shown their quota: they only hear about it if they reach it */}
      {!signedIn && quota && !atLimit && (
        <p class="text-sm text-gray-500">
          Without an account you can scan {quota.per_day} tunes a day
          ({quota.remaining_today} left today). {signInLink('Sign in')} to scan more.
        </p>
      )}

      <div
        class="bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-600 p-6 text-center cursor-pointer"
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
        <img src={preview} alt="The sheet music to scan" class="max-h-80 rounded-xl border border-gray-200 bg-white" />
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
        <Button size="md" onClick={convert} disabled={!canConvert}>Scan and play</Button>
        {busy && <span class="text-sm text-gray-500">{progressText(phase, job, seconds)}</span>}
        {atLimit && !busy && (
          <span class="text-sm text-amber-600">
            {signedIn
              ? 'You’ve reached today’s scanning limit. It resets tomorrow.'
              : <>You’ve reached today’s limit without an account. {signInLink('Sign in')} to keep scanning.</>}
          </span>
        )}
      </div>

      {error && <p class="text-sm text-red-600">{error}</p>}

      {abc && (
        <div class="space-y-4">
          {job?.warnings?.length > 0 && (
            <p class="text-xs text-amber-600">
              Some parts may be off — check the chords and repeats against the original.
            </p>
          )}
          <div class="bg-white rounded-xl border border-gray-200 p-4">
            <AbcViewer abc={abc} transpose={transpose} onTransposeChange={setTranspose} />
          </div>
          <AbcPlayer abc={abc} transpose={transpose} />
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="abc-text" class="text-sm font-medium text-gray-700">ABC notation (you can edit it)</label>
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

// Questions answered under the scanner. Also emitted as FAQPage structured data by
// scripts/prerender.mjs, so keep the answers plain text.
export const FAQ = [
  {
    q: 'Do I need an account?',
    a: 'No. Without an account you can scan a few tunes a day. Sign in with Google to scan more '
      + 'and to keep the tunes you learn in your TuneBox tunebook.',
  },
  {
    q: 'What kind of sheet music works?',
    a: 'Printed music with one melody line, with or without chord symbols above it: fiddle tunes, '
      + 'session and folk tunes, simple song melodies and lead sheets. Handwritten music, piano '
      + 'scores with two staves, multi-part scores and tablature aren’t supported yet.',
  },
  {
    q: 'Which files can I use?',
    a: 'A photo from your phone, a screenshot, a scan (PNG or JPEG) or a PDF, one page at a time. '
      + 'You can also paste an image straight from the clipboard.',
  },
  {
    q: 'How accurate is it?',
    a: 'On clean printed music it usually gets the notes, rhythm, key and chords right. Repeats '
      + 'and first and second endings are the parts most worth checking against the page, and you '
      + 'can fix anything by editing the notation.',
  },
  {
    q: 'Can I slow it down or change the key?',
    a: 'Yes. The player has a speed control and can loop the tune, and you can transpose it up or '
      + 'down a semitone at a time; the notation and playback change together.',
  },
  {
    q: 'What is ABC notation?',
    a: 'A plain-text way of writing tunes, used by thesession.org and most folk-music sites. You '
      + 'can copy or download the result and open it in any ABC program, or keep it in TuneBox.',
  },
];

const STEPS = [
  ['Take a photo', 'Snap the page with your phone, or upload a scan, screenshot or PDF.'],
  ['We read the music', 'Notes, rhythm, key, time signature, repeats and chord symbols, usually in under a minute.'],
  ['Listen and learn', 'Play it back, slow it down, loop it, change the key, and copy or save the notation.'],
];

// Signed-out visitors (and search engines: scripts/prerender.mjs renders this into
// dist/play-sheet-music/index.html) get a standalone page in the style of the /collections/
// index (scripts/build-collections.mjs): slim header with "hosted by TuneBox", a 56rem column,
// a large heading with a brand-coloured phrase, a promo box and a small footer.
export function PublicPage() {
  const { loginWithGoogle } = useAuth();
  return (
    <div class="theme-light min-h-screen bg-gray-50 text-gray-900 text-[15px] leading-normal">
      <header class="sticky top-0 z-20 bg-gray-50/85 backdrop-blur border-b border-gray-200">
        <div class="max-w-[56rem] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <span class="font-semibold text-[.95rem] truncate">Sheet music scanner</span>
          <a href="/" class="flex items-center gap-2 text-[.8rem] text-gray-500 hover:text-gray-700 no-underline whitespace-nowrap">
            hosted by <img src="/tunebook.svg" alt="TuneBox" class="h-6 block" />
          </a>
        </div>
      </header>

      <div class="max-w-[56rem] mx-auto px-4">
        <section class="pt-10 pb-6">
          <h1 class="m-0 mb-3 text-[2rem] leading-[1.15] font-bold tracking-[-.02em]">
            Play sheet music <span class="text-brand-600">from a photo</span>
          </h1>
          <p class="text-gray-600">{INTRO}</p>
        </section>

        <Scanner />

        <section class="mt-12">
          <h2 class="m-0 mb-4 text-[1.3rem] font-bold tracking-[-.01em]">How it works</h2>
          <ol class="grid gap-3 sm:grid-cols-3 list-none p-0 m-0">
            {STEPS.map(([title, text], i) => (
              <li class="bg-white border border-gray-200 rounded-xl p-4">
                <span class="text-[.8rem] font-semibold text-brand-600">{i + 1}</span>
                <h3 class="m-0 mt-1 mb-1 text-base font-semibold">{title}</h3>
                <p class="m-0 text-sm text-gray-600">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section class="mt-10">
          <h2 class="m-0 mb-3 text-[1.3rem] font-bold tracking-[-.01em]">Questions</h2>
          <div class="divide-y divide-gray-200 border-y border-gray-200">
            {FAQ.map(({ q, a }) => (
              <div class="py-4">
                <h3 class="m-0 mb-1 text-base font-semibold">{q}</h3>
                <p class="m-0 text-sm text-gray-600">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section class="bg-brand-50 border border-brand-200 rounded-xl p-6 mt-10 mb-4 text-center">
          <h2 class="m-0 mb-2 text-[1.3rem] font-bold tracking-[-.01em]">Keep the tunes you learn</h2>
          <p class="mx-auto max-w-xl text-gray-600">
            TuneBox is a digital tunebook and practice planner for traditional musicians. Sign in to
            scan more tunes, keep your repertoire organized per instrument, and let spaced
            repetition decide what to practice tonight. Or browse
            the <a href="/collections/" class="text-brand-700 underline">tune collections</a> for
            thousands of tunes from classic tunebooks.
          </p>
          <button
            onClick={() => loginWithGoogle().catch(() => {})}
            class="inline-block mt-4 px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium text-[.9rem] cursor-pointer"
          >
            Sign in with Google
          </button>
        </section>

        <footer class="py-6 text-[.8rem] text-gray-500 text-center">
          <p class="m-0">
            Music recognition by <a href="https://github.com/liebharc/homr" target="_blank" rel="noopener" class="text-brand-700">homr</a>,
            an open-source music reader · page by <a href="/" class="text-brand-700">TuneBox</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export function PlaySheetMusicPage() {
  const { user } = useAuth();
  if (!user) return <PublicPage />;
  return (
    <Shell>
      <div class="max-w-3xl space-y-5">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Play sheet music from a photo</h1>
          <p class="mt-1 text-sm text-gray-600">{INTRO}</p>
        </div>
        <Scanner />
      </div>
    </Shell>
  );
}
