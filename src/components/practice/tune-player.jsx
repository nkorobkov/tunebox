import { useState, useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { setAbcTempo } from '../../lib/abc-utils';
import { ToolTile, PlayIcon, StopIcon } from './tool-tile';

/**
 * Minimal ABC playback for the practice card: a play/stop tile that follows
 * the shared practice tempo, plus a loop toggle. Uses abcjs CreateSynth
 * directly (no SynthController chrome). Re-primes on each play so tempo and
 * transpose changes always apply; soundfont notes are cached by abcjs, so
 * only the first prime is slow.
 */
export function TunePlayer({ abc, tempo, transpose = 0 }) {
  const [state, setState] = useState('idle'); // idle | loading | playing
  const [loop, setLoop] = useState(false);
  const synthRef = useRef(null);
  const loopRef = useRef(false);
  const tokenRef = useRef(0);
  loopRef.current = loop;

  const stop = () => {
    tokenRef.current++;
    if (synthRef.current) {
      try { synthRef.current.stop(); } catch (e) { /* not started */ }
      synthRef.current = null;
    }
    setState('idle');
  };

  const play = async () => {
    const token = ++tokenRef.current;
    setState('loading');
    try {
      const visualObj = abcjs.renderAbc('*', setAbcTempo(abc, tempo), { visualTranspose: transpose })[0];
      const synth = new abcjs.synth.CreateSynth();
      await synth.init({
        visualObj,
        options: {
          soundFontUrl: '/soundfonts/FluidR3_GM/',
          qpm: tempo,
          midiTranspose: transpose,
          // Also fires on stop(); the token tells natural end from user stop.
          onEnded: () => {
            if (token !== tokenRef.current) return;
            if (loopRef.current) {
              synth.start();
            } else {
              synthRef.current = null;
              setState('idle');
            }
          },
        },
      });
      await synth.prime();
      if (token !== tokenRef.current) return;
      synthRef.current = synth;
      synth.start();
      setState('playing');
    } catch (err) {
      console.error('Tune playback failed:', err);
      if (token === tokenRef.current) setState('idle');
    }
  };

  // Tempo/transpose/tune changes invalidate the primed buffer — stop playback.
  useEffect(() => stop, [abc, tempo, transpose]);

  const active = state !== 'idle';

  return (
    <ToolTile
      active={active}
      onClick={active ? stop : play}
      icon={state === 'idle' ? <PlayIcon class="w-5 h-5" /> : <StopIcon class="w-5 h-5" />}
      label="Play tune"
      sublabel={state === 'loading' ? 'loading…' : state === 'playing' ? 'stop' : 'start'}
      corner={
        <button
          onClick={() => setLoop(!loop)}
          title={loop ? 'Looping — tap to play once' : 'Play once — tap to loop'}
          class={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
            loop ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-600'
          }`}
        >loop</button>
      }
    />
  );
}
