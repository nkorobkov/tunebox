import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../lib/auth';
import { Shell } from '../components/layout/shell';
import { Button } from '../components/common/button';
import { AbcViewer } from '../components/tune/abc-viewer';
import { AbcPlayer } from '../components/tune/abc-player';
import { Turnstile } from '../components/parse/turnstile';
import { recognizeWhenAllowed, waitForJob, getQuota, resetsIn, toUploadable, OmrError, TURNSTILE_SITE_KEY } from '../lib/omr-api';
import { isPdfFile, renderPdfPage } from '../lib/pdf-import';
import { parseAbcMeta } from '../lib/abc-utils';
import { parkPendingTune } from '../lib/pending-tune';
import { SignInDialog } from '../components/auth/sign-in-dialog';
import { pb } from '../lib/pb';
import { TUNE_TYPES } from '../components/tune/tune-form';

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

// The scan in progress, kept in this tab's session storage so that reloading the page
// picks it up again: {id, name, preview (a small JPEG data URL), user, started}. The job id is an
// unguessable token, and the service only shows a signed-in user's jobs to that user.
const SCAN_KEY = 'tunebox_scan';

function loadScan() {
  try { return JSON.parse(sessionStorage.getItem(SCAN_KEY)); } catch { return null; }
}

function saveScan(scan) {
  // Storage full or blocked: a reload then just loses the scan, as before
  try { sessionStorage.setItem(SCAN_KEY, JSON.stringify(scan)); } catch { /* ignore */ }
}

function clearScan() {
  try { sessionStorage.removeItem(SCAN_KEY); } catch { /* ignore */ }
}

async function previewDataUrl(blob, maxSide = 1200) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function progressText(phase, job, seconds) {
  if (phase === 'preparing') return 'Preparing…';
  if (phase === 'uploading') return 'Uploading…';
  if (phase === 'waiting') return 'Waiting for your turn…';
  if (job?.status === 'queued') {
    return job.queue_position > 1 ? `In line, ${job.queue_position - 1} ahead…` : 'Starting…';
  }
  return `Reading… ${seconds}s`;
}

const INTRO = 'Upload a photo or PDF of printed music. Listen, slow it down, change the key.';

// The scanner itself; the page around it differs for signed-in users (app shell) and
// visitors (standalone page in the style of /collections/, prerendered for search engines).
function Scanner() {
  const { user } = useAuth();
  const signedIn = !!user;
  const [signInTitle, setSignInTitle] = useState(null); // dialog open when set
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
  const startedRef = useRef(null); // when the scan was uploaded, kept across a reload
  const [resumedPreview, setResumedPreview] = useState(null); // after a reload: no file
  const resultRef = useRef(null);
  const preview = useObjectUrl(image) || resumedPreview;
  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'waiting' || phase === 'working';
  // This image has been scanned: no bot check or scan button until another one is picked
  const scanned = phase === 'done';
  const visitorsOff = !signedIn && !TURNSTILE_SITE_KEY;

  const refreshQuota = useCallback(() => {
    getQuota().then(setQuota).catch(() => setQuota(null));
  }, []);
  useEffect(() => { if (!visitorsOff) refreshQuota(); }, [signedIn, visitorsOff, refreshQuota]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== 'working') return;
    const start = startedRef.current || Date.now();
    setSeconds(Math.max(0, Math.round((Date.now() - start) / 1000)));
    const t = setInterval(() => setSeconds(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Bring the result into view as soon as it arrives
  useEffect(() => {
    if (phase === 'done' && abc) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [phase]);

  const signIn = () => setSignInTitle('Sign in to TuneBox');
  // After "Sign in and save" parked the tune (it's added once sign-in completes)
  const signInToSave = () => setSignInTitle('Sign in to save this tune');

  const pick = async (picked, page = 1) => {
    if (!picked) return;
    setError(''); setJob(null); setAbc(''); setTranspose(0); setFile(picked); setImage(null);
    setResumedPreview(null);
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

  const finish = (result) => {
    setJob(result);
    if (result.status === 'done') {
      setAbc(result.abc);
    } else {
      setError(result.error?.code === 'no_music_found'
        ? 'No sheet music was found in this image. Try a sharper, straighter photo of the page.'
        : result.error?.message || 'The scan failed.');
    }
    setPhase('done');
  };

  const convert = async () => {
    if (!image) return;
    setError(''); setJob(null); setAbc(''); setPhase('uploading');
    startedRef.current = null;
    const controller = new AbortController();
    abortRef.current = controller;
    const name = (file?.name || 'score').replace(/\.[^.]+$/, '') + (image.type === 'image/png' ? '.png' : '.jpg');
    const remember = (id) => {
      startedRef.current = Date.now();
      const scan = { id, name: file?.name || name, preview: null, user: user?.id || null, started: startedRef.current };
      saveScan(scan);
      previewDataUrl(image)
        .then((p) => { if (loadScan()?.id === id) saveScan({ ...scan, preview: p }); })
        .catch(() => {});
    };
    try {
      const result = await recognizeWhenAllowed(image, name, {
        turnstileToken: signedIn ? undefined : token,
        signal: controller.signal,
        onWait: () => setPhase('waiting'),
        onStart: (id) => { setPhase('uploading'); remember(id); },
        onProgress: (j) => { setJob(j); setPhase('working'); },
      });
      clearScan();
      finish(result);
    } catch (err) {
      // Aborted: the page is being left; the stored scan lets it pick the job up again
      if (err.name === 'AbortError') return;
      clearScan();
      setError(err instanceof OmrError ? err.message : 'The scan failed. Try again.');
      setPhase('idle');
    } finally {
      // Bot-check tokens are single use
      if (!signedIn) setTurnstileReset((n) => n + 1);
      refreshQuota();
    }
  };

  // Pick up a scan that was running when the page was reloaded
  useEffect(() => {
    const scan = loadScan();
    if (!scan?.id) return;
    if (scan.user !== (user?.id || null)) { clearScan(); return; }
    setFile({ name: scan.name });
    setResumedPreview(scan.preview);
    startedRef.current = scan.started || null;
    setPhase('working');
    const controller = new AbortController();
    abortRef.current = controller;
    waitForJob(scan.id, { signal: controller.signal, onProgress: setJob })
      .then((result) => { clearScan(); finish(result); })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        clearScan();
        setError(err.code === 'not_found'
          ? 'The scan you started before reloading is no longer available. Please scan the page again.'
          : err instanceof OmrError ? err.message : 'The scan failed. Try again.');
        setPhase('idle');
      })
      .finally(refreshQuota);
  }, []);

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

  const signInDialog = signInTitle && <SignInDialog title={signInTitle} onClose={() => setSignInTitle(null)} />;

  if (visitorsOff) {
    return (
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
        {signInLink('Sign in')} to scan sheet music.
        {signInDialog}
      </div>
    );
  }

  return (
    <div class="space-y-5">
      {/* Signed-in users aren't shown their quota: they only hear about it if they reach it */}
      {!signedIn && quota && !atLimit && (
        <p class="text-sm text-gray-500">
          {quota.remaining_today} of {quota.per_day} free scans left today. {signInLink('Sign in')} for more.
        </p>
      )}

      <div
        class="bg-white rounded-lg border border-dashed border-gray-300 hover:border-gray-500 p-8 text-center cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
      >
        <input ref={inputRef} type="file" accept="image/*,.pdf,application/pdf" class="hidden"
          onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
        <p class="text-sm text-gray-700">
          {file ? file.name : 'Drop, paste or choose an image'}
        </p>
        <p class="text-xs text-gray-400 mt-1">PNG, JPEG or PDF</p>
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
        <img src={preview} alt="The sheet music to scan" class="max-h-80 rounded-lg border border-gray-200 bg-white" />
      )}

      {!signedIn && image && !busy && !scanned && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onToken={setToken}
          resetKey={turnstileReset}
          onError={() => setError('The bot check didn’t load. Allow it in your content blocker, or sign in.')}
        />
      )}

      <div class="flex items-center gap-3 flex-wrap empty:hidden">
        {(image || busy) && !scanned && <Button size="md" onClick={convert} disabled={!canConvert}>Scan</Button>}
        {busy && <span class="text-sm text-gray-500">{progressText(phase, job, seconds)}</span>}
        {atLimit && !busy && (
          <span class="text-sm text-amber-600">
            {signedIn
              ? `Daily limit reached. It resets ${resetsIn(quota.retry_after)}.`
              : <>Daily limit reached. {signInLink('Sign in')} to keep scanning.</>}
          </span>
        )}
      </div>

      {error && <p class="text-sm text-red-600">{error}</p>}

      {abc && (
        <div ref={resultRef} class="space-y-4 scroll-mt-20">
          {job?.warnings?.length > 0 && (
            <p class="text-xs text-amber-600">Check repeats and chords against the original.</p>
          )}
          <div class="bg-white rounded-lg border border-gray-200 p-4">
            <AbcViewer abc={abc} transpose={transpose} onTransposeChange={setTranspose} />
          </div>
          <AbcPlayer abc={abc} transpose={transpose} />
          {signedIn && <AddToTunes key={job?.id} abc={abc} signedIn onSignIn={signInToSave} />}
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="abc-text" class="text-sm font-medium text-gray-700">ABC</label>
              <div class="flex gap-2">
                <Button variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
                <Button variant="secondary" onClick={download}>Download</Button>
              </div>
            </div>
            <textarea
              id="abc-text"
              value={abc}
              onInput={(e) => setAbc(e.target.value)}
              spellcheck={false}
              rows={10}
              class="w-full font-mono text-xs border border-gray-200 rounded-lg p-3 bg-white text-gray-800"
            />
          </div>
          {!signedIn && <AddToTunes key={job?.id} abc={abc} signedIn={false} onSignIn={signInToSave} />}
        </div>
      )}
      {signInDialog}
    </div>
  );
}

// The user_tunes record for a scanned tune: the title goes into the ABC too (scans
// rarely have one), so the notation shows it.
function tuneRecord(abc, title, type) {
  const name = title.trim();
  let text = abc.replace(/^T:.*\n?/m, '');
  text = /^X:.*$/m.test(text) ? text.replace(/^(X:.*)$/m, `$1\nT:${name}`) : `T:${name}\n${text}`;
  const key = /^K:[ \t]*(\S+)/m.exec(abc)?.[1];
  return {
    title: name,
    type: type.trim().toLowerCase() || undefined,
    abc: text,
    setting_key: key && key !== 'none' ? key : undefined,
  };
}

// "Add to my tunes" under a result. Signed in, the tune is created right away; signed
// out, it's parked (src/lib/pending-tune.js) and created once Google sign-in returns to
// the app, which then opens it, so a brand-new account starts with this one tune.
function AddToTunes({ abc, signedIn, onSignIn }) {
  const recognized = parseAbcMeta(abc).title;
  const [title, setTitle] = useState(recognized === 'Untitled' ? '' : recognized);
  const [type, setType] = useState('');
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(null);
  const [error, setError] = useState('');
  const [askTitle, setAskTitle] = useState(false);
  const titleRef = useRef(null);

  const add = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setAskTitle(true);
      titleRef.current?.focus();
      return;
    }
    const tune = tuneRecord(abc, title, type);
    if (!signedIn) {
      try { parkPendingTune(tune); } catch { setError('Couldn’t save the tune. Copy the ABC instead.'); return; }
      onSignIn();
      return;
    }
    setSaving(true); setError('');
    try {
      setAdded(await pb.collection('user_tunes').create({
        ...tune, labels: [], instruments: {}, user: pb.authStore.record.id,
      }));
    } catch {
      setError('Couldn’t add the tune. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (added) {
    return (
      <p class="m-0 text-sm text-gray-700">
        Added “{added.title}” to your tunes. <a href={`/tune/${added.id}`} class="text-brand-700 underline">Open</a>
      </p>
    );
  }

  const field = 'px-3 py-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';
  return (
    <form onSubmit={add} class="space-y-2">
      <div class="flex flex-wrap gap-2">
        <input
          ref={titleRef}
          type="text"
          aria-label="Title"
          value={title}
          onInput={(e) => setTitle(e.target.value)}
          placeholder="Title"
          class={`${field} flex-1 min-w-[12rem] ${askTitle && !title.trim() ? 'border-amber-500' : 'border-gray-300'}`}
        />
        <input
          type="text"
          aria-label="Type"
          value={type}
          onInput={(e) => setType(e.target.value)}
          list="scan-tune-types"
          placeholder="Type (optional)"
          class={`${field} w-40 border-gray-300`}
        />
        <datalist id="scan-tune-types">
          {TUNE_TYPES.map((t) => <option value={t} />)}
        </datalist>
        <Button type="submit" size="md" disabled={saving}>
          {signedIn ? (saving ? 'Adding…' : 'Add to my tunes') : 'Sign in and save'}
        </Button>
      </div>
      {askTitle && !title.trim() && <p class="m-0 text-sm text-amber-600">Name the tune first.</p>}
      {error && <p class="m-0 text-sm text-red-600">{error}</p>}
    </form>
  );
}

// Questions answered under the scanner. Also emitted as FAQPage structured data by
// scripts/prerender.mjs, so keep the answers plain text.
export const FAQ = [
  {
    q: 'Do I need an account?',
    a: 'No. You get a few free scans a day. Sign in for more, and to save tunes.',
  },
  {
    q: 'What sheet music works?',
    a: 'Printed single-line melodies, with or without chord symbols: fiddle, folk and session '
      + 'tunes, song melodies, lead sheets. Not handwriting, piano scores or tablature.',
  },
  {
    q: 'How accurate is it?',
    a: 'Clean printed music usually comes out right. Check repeats and endings; you can edit '
      + 'anything in the notation.',
  },
  {
    q: 'What is ABC?',
    a: 'A plain-text music notation used by thesession.org and most folk-music sites. Copy or '
      + 'download it to use in any ABC program.',
  },
];

// Signed-out visitors (and search engines: scripts/prerender.mjs renders this into
// dist/play-sheet-music/index.html) get a standalone page: slim header with "hosted by
// TuneBox", a 56rem column, the scanner, a short FAQ and a one-line footer.
export function PublicPage() {
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
          <h1 class="m-0 mb-2 text-[2rem] leading-[1.15] font-bold tracking-[-.02em]">
            Play sheet music from a photo
          </h1>
          <p class="m-0 text-gray-600">{INTRO}</p>
        </section>

        <Scanner />

        <section class="mt-16">
          <h2 class="m-0 mb-2 text-base font-semibold">Questions</h2>
          <dl class="m-0 divide-y divide-gray-200 border-y border-gray-200">
            {FAQ.map(({ q, a }) => (
              <div class="py-3">
                <dt class="text-sm font-medium">{q}</dt>
                <dd class="m-0 mt-0.5 text-sm text-gray-600">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer class="py-8 text-[.8rem] text-gray-500">
          <a href="/" class="text-gray-700">TuneBox</a> is a tunebook and practice planner for
          traditional musicians · <a href="/collections/" class="text-gray-700">Tune collections</a> ·
          Recognition by <a href="https://github.com/liebharc/homr" target="_blank" rel="noopener" class="text-gray-700">homr</a>
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
