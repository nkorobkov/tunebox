import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { getAbcMeter, isCompoundMeter } from '../../lib/abc-utils';

function setAbcTempo(abc, bpm, meter) {
  const qField = isCompoundMeter(meter) ? `Q:3/8=${bpm}` : `Q:1/4=${bpm}`;
  if (/^Q:/m.test(abc)) {
    return abc.replace(/^Q:.*$/m, qField);
  }
  return abc.replace(/^(K:.*)$/m, `$1\n${qField}`);
}

function toQpm(bpm, meter) {
  return isCompoundMeter(meter) ? bpm * 1.5 : bpm;
}

export function AbcPlayer({ abc, defaultTempo = 120, transpose = 0, onController }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!abc || !containerRef.current) return;

    const meter = getAbcMeter(abc);
    const abcWithTempo = setAbcTempo(abc, defaultTempo, meter);
    const qpm = toQpm(defaultTempo, meter);
    const visualObj = abcjs.renderAbc('*', abcWithTempo, { responsive: 'resize', visualTranspose: transpose })[0];
    const controller = new abcjs.synth.SynthController();

    controller.load(containerRef.current, null, {
      displayLoop: true,
      displayRestart: true,
      displayPlay: true,
      displayProgress: true,
      displayWarp: true,
    });

    controller.setTune(visualObj, false, { qpm, midiTranspose: transpose });
    controllerRef.current = controller;
    if (onController) onController(controller);

    return () => {
      try { controller.pause(); } catch (e) {}
      controllerRef.current = null;
      if (onController) onController(null);
    };
  }, [abc, defaultTempo, transpose]);

  if (!abc) return null;

  return <div ref={containerRef} />;
}
