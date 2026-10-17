import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { scheduleClick } from '../lib/click';

function getBeatsPerMeasure(timeSignature) {
  const [num] = timeSignature.split('/').map(Number);
  return num;
}

// Lookahead scheduling constants
const SCHEDULE_AHEAD = 0.1; // seconds to schedule into the future
const LOOKAHEAD_MS = 25;    // how often the scheduler runs (ms)

export function useMetronome(initialBpm = 120, initialTimeSignature = '4/4') {
  const [bpm, setBpm] = useState(initialBpm);
  const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  // Refs for current values so the scheduler always sees latest
  const bpmRef = useRef(bpm);
  const tsRef = useRef(timeSignature);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const startScheduler = useCallback(() => {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const beats = getBeatsPerMeasure(tsRef.current);
    beatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime;

    const scheduler = () => {
      const currentBpm = bpmRef.current;
      const currentBeats = getBeatsPerMeasure(tsRef.current);
      const secondsPerBeat = 60.0 / currentBpm;

      while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
        scheduleClick(ctx, nextNoteTimeRef.current, beatRef.current === 0);
        beatRef.current = (beatRef.current + 1) % currentBeats;
        nextNoteTimeRef.current += secondsPerBeat;
      }
    };

    scheduler();
    timerRef.current = setInterval(scheduler, LOOKAHEAD_MS);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (playing) {
      stop();
      return;
    }
    startScheduler();
    setPlaying(true);
  }, [playing, stop, startScheduler]);

  const updateBpm = useCallback((newBpm) => {
    setBpm(newBpm);
    bpmRef.current = newBpm;
  }, []);

  const updateTimeSignature = useCallback((newTs) => {
    setTimeSignature(newTs);
    tsRef.current = newTs;
  }, []);

  // Sync when props change (e.g. navigating to a new tune)
  useEffect(() => {
    setBpm(initialBpm);
    bpmRef.current = initialBpm;
  }, [initialBpm]);

  useEffect(() => {
    setTimeSignature(initialTimeSignature);
    tsRef.current = initialTimeSignature;
  }, [initialTimeSignature]);

  // Cleanup on unmount — stop scheduler and close AudioContext
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { bpm, timeSignature, playing, start, stop, updateBpm, updateTimeSignature };
}
