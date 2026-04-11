import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';

/**
 * Inject or replace Q: tempo header in ABC string so abcjs uses it natively.
 */
function setAbcTempo(abc, qpm) {
  // If ABC already has a Q: field, replace it
  if (/^Q:/m.test(abc)) {
    return abc.replace(/^Q:.*$/m, `Q:1/4=${qpm}`);
  }
  // Insert Q: after K: line (key is typically the last header before the body)
  return abc.replace(/^(K:.*)$/m, `$1\nQ:1/4=${qpm}`);
}

export function AbcPlayer({ abc, defaultTempo = 120 }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!abc || !containerRef.current) return;

    const abcWithTempo = setAbcTempo(abc, defaultTempo);
    const visualObj = abcjs.renderAbc('*', abcWithTempo, { responsive: 'resize' })[0];
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
