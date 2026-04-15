import { useState, useCallback, useEffect } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { PracticeCard } from '../components/practice/practice-card';
import { PracticeEntry } from '../components/practice/practice-entry';
import { useAuth } from '../lib/auth';
import { pb } from '../lib/pb';
import { getDefaultTempo } from '../lib/abc-utils';
import { INITIAL_STABILITY, practicedToday } from '../lib/practice-algorithm';
import {
  useTunesByInstrument, usePracticeSession,
  getDefaultInstrument, saveDefaultInstrument,
  saveLearningPractice, saveLearningStruggle, savePlayingPractice,
} from '../hooks/use-practice';

function learningResultMsg(tempo, movedToPlaying) {
  return movedToPlaying
    ? `Moved to Playing! You've reached target tempo.`
    : `Good! We'll try ${Math.round(tempo * 1.1)} BPM next time.`;
}

const PLAYING_MESSAGES = {
  easy: 'Easy! Stability increased.',
  good: 'Good work! Stability increased.',
  hard: 'Keep at it — we\'ll show this sooner.',
  relearn: 'Moved back to Learning mode.',
};

export function PracticePage({ tune: tuneIdParam }) {
  const { user } = useAuth();
  const userInstruments = user?.instruments || [];
  const [instrument, setInstrument] = useState(() => {
    const saved = getDefaultInstrument();
    return userInstruments.includes(saved) ? saved : (userInstruments[0] || '');
  });
  const [practicing, setPracticing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [isReview, setIsReview] = useState(false);
  const [singleTune, setSingleTune] = useState(null);
  const [singleTuneLoading, setSingleTuneLoading] = useState(!!tuneIdParam);

  const { forInstrument, loading: tunesLoading, refetch } = useTunesByInstrument();
  const session = usePracticeSession(practicing && !singleTune ? instrument : null, { includePracticedToday: isReview });

  // Load single tune if tuneId param is present
  useEffect(() => {
    if (!tuneIdParam) return;
    setSingleTuneLoading(true);
    pb.collection('user_tunes').getOne(tuneIdParam)
      .then(t => { setSingleTune(t); setPracticing(true); })
      .catch(err => console.error('Failed to load tune:', err))
      .finally(() => setSingleTuneLoading(false));
  }, [tuneIdParam]);

  const handleSelectInstrument = (inst) => {
    setInstrument(inst);
    saveDefaultInstrument(inst);
  };

  // Derive learning/playing/notStarted for the selected instrument
  const { learning, playing, notStarted } = forInstrument(instrument);
  const allPracticeable = [...learning, ...playing];
  const unpracticedCount = allPracticeable.filter(t => !practicedToday(t, instrument)).length;
  const practicedCount = allPracticeable.length - unpracticedCount;
  const allDoneForToday = unpracticedCount === 0 && practicedCount > 0;

  const handleStart = () => { setIsReview(false); setPracticing(true); setLastResult(null); };
  const handleReviewAgain = () => { setIsReview(true); setPracticing(true); setLastResult(null); };

  const handleStartLearning = useCallback(async (tune, targetBpm, forInstrument) => {
    const inst = forInstrument || instrument;
    const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
    const updatedInstruments = {
      ...tune.instruments,
      [inst]: { keys: [], current_tempo: 0, target_tempo: targetBpm || fallback, stability: INITIAL_STABILITY, last_practiced: null },
    };
    await pb.collection('user_tunes').update(tune.id, { instruments: updatedInstruments });
    await refetch(true);
  }, [instrument, refetch]);

  const handleStop = () => {
    if (singleTune) {
      setSingleTune(null);
      setLastResult(null);
      setPracticing(false);
      history.replaceState(null, '', '/practice');
      refetch();
      return;
    }
    setPracticing(false);
    refetch();
  };

  // Shared handler: save practice, show message, advance queue if in session
  const completePractice = useCallback(async (saveFn, getMsg) => {
    const res = await saveFn();
    const msg = typeof getMsg === 'function' ? getMsg(res) : getMsg;
    setLastResult(msg);
    if (!singleTune) {
      setTimeout(() => { setLastResult(null); session.advance(); }, 2000);
    }
    return res;
  }, [singleTune, session]);

  const onCompleteLearning = useCallback(async (tune, tempo) => {
    return completePractice(
      () => singleTune
        ? saveLearningPractice(tune, instrument, tempo)
        : session.completeLearning(tune, tempo),
      (res) => learningResultMsg(tempo, res.movedToPlaying),
    );
  }, [singleTune, instrument, session, completePractice]);

  const onStruggleLearning = useCallback(async (tune) => {
    return completePractice(
      () => singleTune
        ? saveLearningStruggle(tune, instrument)
        : session.completeLearningStruggle(tune),
      'Good effort! We\'ll try again next time.',
    );
  }, [singleTune, instrument, session, completePractice]);

  const onCompletePlaying = useCallback(async (tune, rating) => {
    return completePractice(
      () => singleTune
        ? savePlayingPractice(tune, instrument, rating)
        : session.completePlaying(tune, rating),
      PLAYING_MESSAGES[rating],
    );
  }, [singleTune, instrument, session, completePractice]);

  // Loading single tune
  if (singleTuneLoading) {
    return <Shell><p class="text-gray-400 text-center py-12">Loading...</p></Shell>;
  }

  // Entry page
  if (!practicing) {
    return (
      <Shell>
        <h1 class="text-2xl font-bold text-gray-900 mb-6">Practice</h1>
        {tunesLoading ? (
          <p class="text-gray-400 text-center py-12">Loading...</p>
        ) : (
          <PracticeEntry
            userInstruments={userInstruments}
            selectedInstrument={instrument}
            onSelectInstrument={handleSelectInstrument}
            learning={learning}
            playing={playing}
            notStarted={notStarted}
            onStart={handleStart}
            onStartLearning={handleStartLearning}
            allDoneForToday={allDoneForToday}
            onReviewAgain={handleReviewAgain}
          />
        )}
      </Shell>
    );
  }

  // Active practice (single tune or queue)
  const currentTune = singleTune || session.currentTune;
  const isLoading = !singleTune && session.loading;

  return (
    <Shell>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Practice</h1>
        <div class="flex items-center gap-4">
          {!singleTune && session.remaining > 0 && (
            <span class="text-sm text-gray-500">{session.remaining} remaining</span>
          )}
          <button onClick={handleStop} class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">Stop</button>
        </div>
      </div>

      {isLoading ? (
        <p class="text-gray-400 text-center py-12">Building practice queue...</p>
      ) : lastResult ? (
        <div class="text-center py-12">
          <p class="text-lg font-medium text-gray-900">{lastResult}</p>
          {singleTune && (
            <div class="flex items-center justify-center gap-4 mt-4">
              <button onClick={handleStop} class="text-sm text-blue-600 hover:underline cursor-pointer">Practice more tunes</button>
              <a href="/" class="text-sm text-gray-500 hover:text-gray-700 no-underline">Back to library</a>
            </div>
          )}
        </div>
      ) : !currentTune ? (
        <div class="text-center py-12">
          <p class="text-2xl mb-2">All done!</p>
          <p class="text-gray-500">
            {session.totalCount === 0 ? 'No tunes to practice on this instrument.' : 'You\'ve gone through all your tunes. Great work!'}
          </p>
          <button onClick={handleStop} class="text-sm text-blue-600 hover:underline mt-4 inline-block cursor-pointer">Back to practice home</button>
        </div>
      ) : (
        <PracticeCard
          tune={currentTune}
          instrument={instrument}
          onCompleteLearning={onCompleteLearning}
          onStruggleLearning={onStruggleLearning}
          onCompletePlaying={onCompletePlaying}
          onSkip={singleTune ? handleStop : session.skip}
        />
      )}
    </Shell>
  );
}
