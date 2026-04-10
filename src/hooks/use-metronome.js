import { useState, useRef, useCallback } from 'preact/hooks';

export function useMetronome(initialBpm = 120) {
  const [bpm, setBpm] = useState(initialBpm);
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);

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

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;

    const click = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1000;
      gain.gain.value = 0.3;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    };

    click();
    intervalRef.current = setInterval(click, 60000 / bpm);
    setPlaying(true);
  }, [bpm, playing, stop]);

  const updateBpm = useCallback((newBpm) => {
    setBpm(newBpm);
    if (playing) {
      // Restart with new tempo
      if (intervalRef.current) clearInterval(intervalRef.current);
      const ctx = audioCtxRef.current;
      const click = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 1000;
        gain.gain.value = 0.3;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      };
      intervalRef.current = setInterval(click, 60000 / newBpm);
    }
  }, [playing]);

  return { bpm, playing, start, stop, updateBpm };
}
