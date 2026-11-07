import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { setAbcTempo, openImplicitRepeats } from '../../lib/abc-utils';
import { claimPlaybackSession } from '../../lib/audio-session';

/**
 * `disabled` (with `disabledTitle`): greys the controls out and pauses the
 * tune if it's playing — the practice card sets it while the generated
 * backing plays, so the two never sound together.
 */
export function AbcPlayer({ abc, defaultTempo = 120, transpose = 0, disabled = false, disabledTitle }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (!abc || !containerRef.current) return;

    const abcWithTempo = setAbcTempo(abc, defaultTempo);
    const visualObj = abcjs.renderAbc('*', abcWithTempo, { responsive: 'resize', visualTranspose: transpose })[0];
    openImplicitRepeats(visualObj);
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

  useEffect(() => {
    if (disabled) {
      try { controllerRef.current?.pause(); } catch (e) {}
    }
  }, [disabled]);

  if (!abc) return null;

  // capture phase: runs before the controller's play handler creates its AudioContext
  return (
    <div title={disabled ? disabledTitle : undefined} class={disabled ? 'cursor-not-allowed' : undefined}>
      <div
        ref={containerRef}
        onClickCapture={claimPlaybackSession}
        aria-disabled={disabled || undefined}
        class={disabled ? 'opacity-40 pointer-events-none' : undefined}
      />
    </div>
  );
}
