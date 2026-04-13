import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

// For compound meters (6/8, 9/8, 12/8), beats are grouped in 3s
// so we click per dotted-quarter group, not per eighth note.
function getBeatsPerMeasure(timeSignature) {
  const [num, den] = timeSignature.split('/').map(Number);
  // Compound meters: denominator is 8 and numerator divisible by 3
  if (den === 8 && num % 3 === 0) return num / 3;
  return num;
}

export function useMetronome(initialBpm = 120, initialTimeSignature = '4/4') {
  const [bpm, setBpm] = useState(initialBpm);
  const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const beatRef = useRef(0);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const click = useCallback((ctx, accent) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    // Accented beat: higher pitch + louder
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.value = accent ? 0.4 : 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }, []);

  const startLoop = useCallback((bpmVal, tsSig) => {
    const ctx = getCtx();
    const beats = getBeatsPerMeasure(tsSig);
    beatRef.current = 0;

    const tick = () => {
      click(ctx, beatRef.current === 0);
      beatRef.current = (beatRef.current + 1) % beats;
    };

    tick();
    intervalRef.current = setInterval(tick, 60000 / bpmVal);
  }, [click]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (playing) {
      stop();
      return;
    }
    startLoop(bpm, timeSignature);
    setPlaying(true);
  }, [bpm, timeSignature, playing, stop, startLoop]);

  const updateBpm = useCallback((newBpm) => {
    setBpm(newBpm);
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      startLoop(newBpm, timeSignature);
    }
  }, [playing, timeSignature, startLoop]);

  const updateTimeSignature = useCallback((newTs) => {
    setTimeSignature(newTs);
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      startLoop(bpm, newTs);
    }
  }, [playing, bpm, startLoop]);

  // Sync initialBpm changes (e.g. when tune changes)
  useEffect(() => {
    setBpm(initialBpm);
  }, [initialBpm]);

  useEffect(() => {
    setTimeSignature(initialTimeSignature);
  }, [initialTimeSignature]);

  return { bpm, timeSignature, playing, start, stop, updateBpm, updateTimeSignature };
}
