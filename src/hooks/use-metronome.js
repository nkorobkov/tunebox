import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { getAudioContext } from '../lib/audio-context';
import { isCompoundMeter } from '../lib/abc-utils';

function getBeatsPerMeasure(timeSignature) {
  const [num] = timeSignature.split('/').map(Number);
  return num;
}

// For compound meters (6/8, 9/8, 12/8), BPM = dotted-quarter rate.
// Each dotted quarter = 3 eighth-note beats, so the per-beat interval is 3x faster.
// For simple meters, BPM = quarter-note rate = one beat.
function getSecondsPerBeat(bpm, timeSignature) {
  return isCompoundMeter(timeSignature) ? 60.0 / (bpm * 3) : 60.0 / bpm;
}

// Lookahead scheduling constants
const SCHEDULE_AHEAD = 0.1; // seconds to schedule into the future
const LOOKAHEAD_MS = 25;    // how often the scheduler runs (ms)

export function useMetronome(initialBpm = 120, initialTimeSignature = '4/4') {
  const [bpm, setBpm] = useState(initialBpm);
  const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  // Refs for current values so the scheduler always sees latest
  const bpmRef = useRef(bpm);
  const tsRef = useRef(timeSignature);

  const scheduleClick = useCallback((time, accent) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(accent ? 0.9 : 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.start(time);
    osc.stop(time + 0.08);
  }, []);

  const startScheduler = useCallback(() => {
    const ctx = getAudioContext();
    beatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime;

    const scheduler = () => {
      const ctx = getAudioContext();
      const currentBpm = bpmRef.current;
      const currentBeats = getBeatsPerMeasure(tsRef.current);
      const secondsPerBeat = getSecondsPerBeat(currentBpm, tsRef.current);

      while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
        scheduleClick(nextNoteTimeRef.current, beatRef.current === 0);
        beatRef.current = (beatRef.current + 1) % currentBeats;
        nextNoteTimeRef.current += secondsPerBeat;
      }
    };

    scheduler();
    timerRef.current = setInterval(scheduler, LOOKAHEAD_MS);
  }, [scheduleClick]);

  const stop = useCallback(() => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) return; // already running
    startScheduler();
    setPlaying(true);
  }, [startScheduler]);

  const updateBpm = useCallback((newBpm) => {
    setBpm(newBpm);
    bpmRef.current = newBpm;
  }, []);

  const updateTimeSignature = useCallback((newTs) => {
    setTimeSignature(newTs);
    tsRef.current = newTs;
  }, []);

  useEffect(() => {
    if (initialBpm !== bpmRef.current) {
      setBpm(initialBpm);
      bpmRef.current = initialBpm;
    }
  }, [initialBpm]);

  useEffect(() => {
    if (initialTimeSignature !== tsRef.current) {
      setTimeSignature(initialTimeSignature);
      tsRef.current = initialTimeSignature;
    }
  }, [initialTimeSignature]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { bpm, timeSignature, playing, start, stop, updateBpm, updateTimeSignature };
}
