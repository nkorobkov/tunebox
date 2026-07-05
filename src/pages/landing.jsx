import { useState, useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { useAuth } from '../lib/auth';

// A-part of The Kesh (traditional jig) — rendered live in the hero mock.
const HERO_ABC = `X:1
R:jig
M:6/8
L:1/8
K:G
|:G3 GAB|ABA ABd|edd gdd|edB dBA|
GAG GAB|ABA ABd|edd gdd|BAF G3:|`;

function GoogleIcon({ size = 'w-5 h-5' }) {
  return (
    <svg class={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function Icon({ path, extra }) {
  return (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={path} />
      {extra && <path d={extra} />}
    </svg>
  );
}

const ICONS = {
  instruments: 'M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z',
  abc: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
  tagDot: 'M6 6h.008v.008H6V6z',
  mic: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z',
  offline: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 18.75h.008v.008H12v-.008z',
  offlineSlash: 'M3.53 3.53l16.94 16.94',
};

function AbcSnippet() {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      abcjs.renderAbc(ref.current, HERO_ABC, { responsive: 'resize', add_classes: true, paddingtop: 0, paddingbottom: 0 });
    }
  }, []);
  return <div ref={ref} class="abc-viewer" aria-label="Sheet music for The Kesh, a traditional jig" />;
}

// Static mock of the practice card — shows the product without being interactive.
function PracticeCardMock() {
  return (
    <div aria-hidden="true" class="select-none">
      <div class="bg-white rounded-2xl shadow-xl border border-gray-200 p-5 sm:p-6">
        <div class="flex items-start justify-between mb-1">
          <h3 class="text-lg font-semibold text-gray-900">The Kesh</h3>
          <span class="text-xs text-gray-400 mt-1.5">3 tunes remaining</span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 mb-4">
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Jig</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Whistle</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-[#389833]/10 text-[#2d7a29]">session favourites</span>
        </div>
        <AbcSnippet />
        <div class="flex items-center justify-between mt-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <span class="text-sm text-gray-600">Today's tempo</span>
          <span class="text-sm font-medium text-gray-900">96 BPM <span class="text-gray-400 font-normal">→ target 112</span></span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-4">
          <span class="text-center text-sm font-medium py-2 rounded-lg border border-gray-300 text-gray-600">Hard</span>
          <span class="text-center text-sm font-medium py-2 rounded-lg border border-gray-300 text-gray-600">Good</span>
          <span class="text-center text-sm font-medium py-2 rounded-lg bg-[#389833] text-white">Easy</span>
        </div>
      </div>
      <p class="text-center text-xs text-gray-400 mt-3">Practice mode — TuneBox picks the tune and the tempo.</p>
    </div>
  );
}

function GoogleButton({ onClick, children, class: cls = '' }) {
  return (
    <button
      onClick={onClick}
      class={`inline-flex items-center justify-center gap-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${cls}`}
    >
      <GoogleIcon />
      {children}
    </button>
  );
}

const FEATURES = [
  {
    icon: <Icon path={ICONS.instruments} />,
    title: 'Every instrument, tracked separately',
    body: 'The same tune on fiddle and whistle are different skills. TuneBox keeps tempo, keys, and progress per instrument, so each one gets its own practice queue.',
  },
  {
    icon: <Icon path={ICONS.abc} />,
    title: 'ABC notation, alive',
    body: 'Paste ABC and get clean sheet music, synth playback at any tempo, and one-tap transposition. A built-in metronome keeps you honest.',
  },
  {
    icon: <Icon path={ICONS.search} />,
    title: 'Import from thesession.org',
    body: 'Search the largest archive of traditional tunes and pull one in — notation included — in seconds. Bulk-import whole tunebooks, too.',
  },
  {
    icon: <Icon path={ICONS.tag} extra={ICONS.tagDot} />,
    title: 'Sets, tags, and labels',
    body: 'Group tunes into sets in playing order, tag them for gigs and sessions, and filter your library or practice session by any of it.',
  },
  {
    icon: <Icon path={ICONS.mic} />,
    title: 'Recordings and backing tracks',
    body: 'Attach source recordings, record yourself to hear your progress, or record a backing track and play along — retempo\'d to today\'s practice speed.',
  },
  {
    icon: <Icon path={ICONS.offline} extra={ICONS.offlineSlash} />,
    title: 'Works offline',
    body: 'TuneBox installs to your phone like an app. Your tunes are cached locally and practice logs sync when you\'re back online.',
  },
];

const STEPS = [
  {
    title: 'Learning mode: climb the tempo ladder',
    body: 'New tunes start slow. TuneBox remembers the tempo you can actually play and nudges the metronome up each session until you hit target speed.',
  },
  {
    title: 'Playing mode: never lose a tune',
    body: 'Once a tune is up to speed, TuneBox models how quickly it fades from your fingers and brings it back for review just before it slips away.',
  },
  {
    title: 'One tap, and on to the next',
    body: 'Open the practice queue, play the tune, rate it Easy, Good, or Hard. That\'s the whole workflow — the scheduling maths is TuneBox\'s job.',
  },
];

export function LandingPage() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Login failed:', err);
      setError('Sign-in failed. Please try again.');
    }
  };

  return (
    <div class="min-h-screen bg-gray-50 text-gray-900">
      {/* Header — quick sign-in for returning users */}
      <header class="sticky top-0 z-20 bg-gray-50/80 backdrop-blur border-b border-gray-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <img src="/tunebook.svg" alt="TuneBox" class="h-7" />
          <GoogleButton onClick={handleLogin} class="px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">
            Sign in
          </GoogleButton>
        </div>
      </header>

      {/* Hero */}
      <section class="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <h1 class="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
              Every tune you know, <span class="text-[#389833]">ready when you are.</span>
            </h1>
            <p class="mt-5 text-lg text-gray-600 max-w-xl">
              TuneBox keeps your repertoire organized across all your instruments and tells you
              exactly what to practice today — spaced repetition built for tunes, not flashcards.
            </p>
            <div class="mt-8 flex flex-col items-start gap-3">
              <GoogleButton onClick={handleLogin} class="px-6 py-3 text-base bg-white border border-gray-300 shadow-sm text-gray-800 hover:bg-gray-100">
                Continue with Google
              </GoogleButton>
              {error && <p class="text-sm text-red-600">{error}</p>}
              <p class="text-sm text-gray-500">Free · Nothing to install · Your data exports anytime</p>
            </div>
          </div>
          <PracticeCardMock />
        </div>
      </section>

      {/* How practice works */}
      <section class="bg-white border-y border-gray-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 class="text-3xl font-bold tracking-tight text-center">Practice that plans itself</h2>
          <p class="mt-3 text-gray-600 text-center max-w-2xl mx-auto">
            Fifty tunes in, "what should I play tonight?" becomes the hard part.
            TuneBox answers it with an algorithm built around how musicians actually learn.
          </p>
          <div class="mt-12 grid sm:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div class="w-9 h-9 rounded-full bg-[#389833] text-white flex items-center justify-center font-semibold mb-4">{i + 1}</div>
                <h3 class="font-semibold text-lg">{step.title}</h3>
                <p class="mt-2 text-gray-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 class="text-3xl font-bold tracking-tight text-center">More than a tune list</h2>
        <p class="mt-3 text-gray-600 text-center max-w-2xl mx-auto">
          Everything around the practice — collecting, organizing, hearing, and sharing your tunes.
        </p>
        <div class="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} class="bg-white rounded-xl border border-gray-200 p-6">
              <div class="text-[#389833] mb-3">{f.icon}</div>
              <h3 class="font-semibold">{f.title}</h3>
              <p class="mt-2 text-sm text-gray-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data ownership strip */}
      <section class="bg-white border-y border-gray-200">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-14 text-center">
          <h2 class="text-2xl font-bold tracking-tight">Your tunebook stays yours</h2>
          <p class="mt-3 text-gray-600 max-w-2xl mx-auto">
            Export a printable PDF tunebook with a full index, a plain ABC file that opens anywhere,
            or a complete ZIP archive with every recording and practice log. No lock-in, ever.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section class="bg-[#101828]">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <h2 class="text-3xl font-bold tracking-tight text-white">Your tunes are waiting.</h2>
          <p class="mt-3 text-gray-400 max-w-xl mx-auto">
            Sign in, add the tunes you're working on, and let tonight's practice plan itself.
          </p>
          <div class="mt-8 flex justify-center">
            <GoogleButton onClick={handleLogin} class="px-6 py-3 text-base bg-white text-gray-800 hover:bg-gray-100">
              Continue with Google
            </GoogleButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="bg-[#101828] border-t border-gray-800">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <span>TuneBox — a practice companion for traditional musicians</span>
          <span>
            <a href="/privacy.html" class="underline hover:text-gray-300">Privacy Policy</a>
            {' '}&middot;{' '}
            <a href="/terms.html" class="underline hover:text-gray-300">Terms of Service</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
