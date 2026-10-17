import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { setAbcTempo } from '../../lib/abc-utils';
import { claimPlaybackSession } from '../../lib/audio-session';

export function AbcPlayer({ abc, defaultTempo = 120, transpose = 0 }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!abc || !containerRef.current) return;

    const abcWithTempo = setAbcTempo(abc, defaultTempo);
    const visualObj = abcjs.renderAbc('*', abcWithTempo, { responsive: 'resize', visualTranspose: transpose })[0];
    const controller = new abcjs.synth.SynthController();

    controller.load(containerRef.current, null, {
      displayLoop: true,
      displayRestart: true,
      displayPlay: true,
      displayProgress: true,
      displayWarp: true,
    });

    controller.setTune(visualObj, false, {
      qpm: defaultTempo,
      midiTranspose: transpose,
      soundFontUrl: '/soundfonts/FluidR3_GM/',
    });
    controllerRef.current = controller;

    return () => {
      try { controller.pause(); } catch (e) {}
      controllerRef.current = null;
    };
  }, [abc, defaultTempo, transpose]);

  if (!abc) return null;

  // capture phase: runs before the controller's play handler creates its AudioContext
  return <div ref={containerRef} onClickCapture={claimPlaybackSession} />;
}
