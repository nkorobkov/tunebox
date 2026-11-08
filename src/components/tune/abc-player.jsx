import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { setAbcTempo, openImplicitRepeats } from '../../lib/abc-utils';
import { claimPlaybackSession } from '../../lib/audio-session';
import { parseBars } from '../../lib/backing/abc-bars';

/**
 * `disabled` (with `disabledTitle`): greys the controls out and pauses the
 * tune if it's playing — the practice card sets it while the generated
 * backing plays, so the two never sound together.
 * `onCursor(key | null)` (optional): reports the note being played as
 * "bar:off" (written bar + offset, as in backing/abc-bars), so a score
 * rendered from a different ABC string (e.g. with chord symbols) can mark it.
 */
export function AbcPlayer({ abc, defaultTempo = 120, transpose = 0, disabled = false, disabledTitle, onCursor }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;

  useEffect(() => {
    if (!abc || !containerRef.current) return;

    const abcWithTempo = setAbcTempo(abc, defaultTempo);
    const visualObj = abcjs.renderAbc('*', abcWithTempo, { responsive: 'resize', visualTranspose: transpose })[0];
    openImplicitRepeats(visualObj);
    const controller = new abcjs.synth.SynthController();

    // startChars in the events refer to abcWithTempo; key them by bar + offset
    let charMap = null;
    const report = (key) => onCursorRef.current?.(key);
    const cursorControl = {
      onEvent: (ev) => {
        if (!onCursorRef.current) return;
        if (!charMap) charMap = parseBars(abcWithTempo)?.charMap || new Map();
        const chars = ev.startCharArray?.length ? ev.startCharArray : [ev.startChar];
        const pos = chars.map(c => charMap.get(c)).find(Boolean);
        if (pos) report(`${pos.bar}:${pos.off}`);
      },
      onFinished: () => report(null),
    };

    controller.load(containerRef.current, cursorControl, {
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
      report(null);
    };
  }, [abc, defaultTempo, transpose]);

  useEffect(() => {
    if (disabled) {
      try { controllerRef.current?.pause(); } catch (e) {}
      onCursorRef.current?.(null);
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
