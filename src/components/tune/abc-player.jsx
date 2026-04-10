import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';

export function AbcPlayer({ abc, defaultTempo = 120 }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!abc || !containerRef.current) return;

    const visualObj = abcjs.renderAbc('*', abc, { responsive: 'resize' })[0];
    const controller = new abcjs.synth.SynthController();

    controller.load(containerRef.current, null, {
      displayLoop: true,
      displayRestart: true,
      displayPlay: true,
      displayProgress: true,
      displayWarp: true,
    });

    controller.setTune(visualObj, false, { qpm: defaultTempo });
    controllerRef.current = controller;

    return () => {
      try { controller.pause(); } catch (e) {}
      controllerRef.current = null;
    };
  }, [abc, defaultTempo]);

  if (!abc) return null;

  return <div ref={containerRef} />;
}
