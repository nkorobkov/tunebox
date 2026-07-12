import { useState, useCallback, useEffect } from 'preact/hooks';
import { route } from 'preact-router';
import { Shell } from '../components/layout/shell';
import { PracticeCard } from '../components/practice/practice-card';
import { PracticeEntry } from '../components/practice/practice-entry';
import { SessionSummary, MoreTunes } from '../components/practice/session-summary';
import { Button } from '../components/common/button';
import { useAuth } from '../lib/auth';
import { pb } from '../lib/pb';
import { getDefaultTempo } from '../lib/abc-utils';
import { INITIAL_STABILITY, practicedToday, nextLearningTempo, getInstrumentData } from '../lib/practice-algorithm';
import { LoadingIndicator } from '../components/loading-indicator';
import {
  useTunesByInstrument, usePracticeSession,
  getDefaultInstrument, saveDefaultInstrument,
  saveLearningPractice, saveLearningStruggle, savePlayingPractice,
} from '../hooks/use-practice';
import { getTuneFromCache } from '../lib/tune-cache';

function learningResultMsg(tempo, movedToPlaying, targetTempo) {
  if (movedToPlaying) return `Moved to Playing! You've reached target tempo.`;
  const next = Math.round(nextLearningTempo(tempo, targetTempo));
  return `Good! We'll try ${next} BPM next time.`;
}

const PLAYING_MESSAGES = {
  easy: 'Easy! We\'ll wait longer before showing this one again.',
  good: 'Good work! This one can rest a little longer.',
  hard: 'Keep at it — we\'ll bring this one back sooner.',
  relearn: 'Back to learning mode — we\'ll rebuild it from a slower tempo.',
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
  const [selectedTags, setSelectedTags] = useState([]);
  const [sessionLog, setSessionLog] = useState([]);
  const [showSummary, setShowSummary] = useState(false);

  const { forInstrument, loading: tunesLoading, refetch } = useTunesByInstrument();
  const session = usePracticeSession(practicing && !singleTune ? instrument : null, { includePracticedToday: isReview, tags: selectedTags });

  // Load single tune if tuneId param is present; reset when the param goes
  // away (back button or nav link) — the route stays mounted either way.
  useEffect(() => {
    if (!tuneIdParam) {
      setSingleTune(null);
      setSingleTuneLoading(false);
      setPracticing(false);
      setLastResult(null);
      return;
    }
    setSingleTuneLoading(true);
    pb.collection('user_tunes').getOne(tuneIdParam)
      .then(t => { setSingleTune(t); setPracticing(true); })
      .catch(err => {
        const cached = getTuneFromCache(pb.authStore.record?.id, tuneIdParam);
        if (cached) {
          setSingleTune(cached);
          setPracticing(true);
        } else {
          console.error('Failed to load tune:', err);
        }
      })
      .finally(() => setSingleTuneLoading(false));
  }, [tuneIdParam]);

  const handleSelectInstrument = (inst) => {
    setInstrument(inst);
    saveDefaultInstrument(inst);
  };

  // Derive learning/playing/notStarted for the selected instrument
  const { learning: allLearning, playing: allPlaying, notStarted } = forInstrument(instrument);

  // Collect all unique tags from practiceable tunes
  const allTags = [...new Set(
    [...allLearning, ...allPlaying]
      .flatMap(t => (t.labels || []).filter(l => l.type === 'tag').map(l => l.value))
  )].sort();

  // Filter by selected tags
  const filterByTags = (tunes) => {
    if (selectedTags.length === 0) return tunes;
    return tunes.filter(t =>
      (t.labels || []).some(l => l.type === 'tag' && selectedTags.includes(l.value))
    );
  };
  const learning = filterByTags(allLearning);
  const playing = filterByTags(allPlaying);

  const allPracticeable = [...learning, ...playing];
  const unpracticedCount = allPracticeable.filter(t => !practicedToday(t, instrument)).length;
  const practicedCount = allPracticeable.length - unpracticedCount;
  const allDoneForToday = unpracticedCount === 0 && practicedCount > 0;

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const startSession = (review) => {
    setIsReview(review);
    setSessionLog([]);
    setShowSummary(false);
    setPracticing(true);
    setLastResult(null);
  };
  const handleStart = () => startSession(false);
  const handleReviewAgain = () => startSession(true);

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
      // Router prop change triggers the reset effect above
      route('/practice', true);
      refetch();
      return;
    }
    setPracticing(false);
    if (sessionLog.length > 0) setShowSummary(true);
    refetch();
  };

  const logEntry = useCallback((entry) => {
    setSessionLog(prev => [...prev, entry]);
  }, []);

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

  const onCompleteLearning = useCallback(async (tune, tempo, durationSec) => {
    const fallback = tune.canonical_tempo || getDefaultTempo(tune.type);
    const { target_tempo, current_tempo } = getInstrumentData(tune, instrument, fallback);
    return completePractice(
      async () => {
        const res = singleTune
          ? await saveLearningPractice(tune, instrument, tempo)
          : await session.completeLearning(tune, tempo);
        logEntry({ tune, mode: 'learning', tempo, prevTempo: current_tempo, outcome: res.movedToPlaying ? 'moved' : 'progress', durationSec });
        return res;
      },
      (res) => learningResultMsg(tempo, res.movedToPlaying, target_tempo),
    );
  }, [singleTune, instrument, session, completePractice, logEntry]);

  const onStruggleLearning = useCallback(async (tune, durationSec) => {
    return completePractice(
      async () => {
        const res = singleTune
          ? await saveLearningStruggle(tune, instrument)
          : await session.completeLearningStruggle(tune);
        logEntry({ tune, mode: 'learning', outcome: 'struggle', durationSec });
        return res;
      },
      'Good effort! We\'ll try again next time.',
    );
  }, [singleTune, instrument, session, completePractice, logEntry]);

  const onCompletePlaying = useCallback(async (tune, rating, tempo, durationSec) => {
    return completePractice(
      async () => {
        const res = singleTune
          ? await savePlayingPractice(tune, instrument, rating, tempo)
          : await session.completePlaying(tune, rating, tempo);
        logEntry({ tune, mode: 'playing', tempo, outcome: rating, durationSec });
        return res;
      },
      PLAYING_MESSAGES[rating],
    );
  }, [singleTune, instrument, session, completePractice, logEntry]);

  const handleSkip = useCallback(() => {
    if (session.currentTune) {
      logEntry({ tune: session.currentTune, mode: null, outcome: 'skip', durationSec: 0 });
    }
    session.skip();
  }, [session, logEntry]);

  // Queue exhausted after practicing something → move to the summary screen.
  const queueExhausted = practicing && !singleTune && !session.loading && !session.currentTune && !lastResult;
  useEffect(() => {
    if (queueExhausted && sessionLog.length > 0) {
      setPracticing(false);
      setShowSummary(true);
    }
  }, [queueExhausted, sessionLog.length]);

  // Refresh tune data behind the summary / post-practice screens so
  // practiced-today status in the "more tunes" lists is current.
  useEffect(() => {
    if (showSummary || (lastResult && singleTune)) refetch(true);
  }, [showSummary, lastResult, singleTune, refetch]);

  const backHome = () => {
    setShowSummary(false);
    setSessionLog([]);
  };

  // Loading single tune
  if (singleTuneLoading) {
    return <Shell><LoadingIndicator /></Shell>;
  }

  // Entry page / session summary
  if (!practicing) {
    return (
      <Shell>
        {tunesLoading ? (
          <LoadingIndicator />
        ) : showSummary ? (
          <SessionSummary
            entries={sessionLog}
            instrument={instrument}
            learning={allLearning}
            playing={allPlaying}
            notStarted={notStarted}
            onStartLearning={handleStartLearning}
            onBackHome={backHome}
          />
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
            allTags={allTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
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
      <div class="flex items-center justify-end mb-6">
        <div class="flex items-center gap-4">
          {!singleTune && session.remaining > 0 && (
            <span class="text-sm text-gray-500">{session.remaining} remaining</span>
          )}
          <button onClick={handleStop} class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">Stop</button>
        </div>
      </div>

      {isLoading ? (
        <LoadingIndicator text="Building practice queue" />
      ) : lastResult ? (
        singleTune ? (
          <div class="space-y-6">
            <div class="text-center pt-4">
              <p class="text-lg font-medium text-gray-900">{lastResult}</p>
            </div>
            <MoreTunes
              learning={allLearning}
              playing={allPlaying}
              notStarted={notStarted}
              instrument={instrument}
              onStartLearning={handleStartLearning}
            />
            <div class="flex items-center justify-center gap-3">
              <Button variant="secondary" size="lg" onClick={handleStop}>Back to practice home</Button>
              <Button variant="ghost" size="lg" href="/">Back to library</Button>
            </div>
          </div>
        ) : (
          <div class="text-center py-12">
            <p class="text-lg font-medium text-gray-900">{lastResult}</p>
          </div>
        )
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
          key={`${currentTune.id}-${instrument}`}
          tune={currentTune}
          instrument={instrument}
          onCompleteLearning={onCompleteLearning}
          onStruggleLearning={onStruggleLearning}
          onCompletePlaying={onCompletePlaying}
          onSkip={singleTune ? handleStop : handleSkip}
        />
      )}
    </Shell>
  );
}
