import { useState, useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';
import { useConnectivity } from '../../lib/connectivity';

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const KEY_MAP = { 'C#': 1, 'Db': 1, 'D#': 3, 'Eb': 3, 'F#': 6, 'Gb': 6, 'G#': 8, 'Ab': 8, 'A#': 10, 'Bb': 10 };

function transposedKeyName(abc, semitones) {
  // Horizontal whitespace only: with a bare "K: F" a \s would run on into the
  // tune body. A trailing comment ("% ...") isn't part of the key either.
  const m = abc.match(/^K:[ \t]*([A-G][b#]?)[ \t]*([^\n%]*)/m);
  if (!m) return null;
  const root = m[1], suffix = m[2].trim(); // suffix = "maj", "min", "m", "Dor", etc.
  const idx = KEY_MAP[root] ?? KEYS.indexOf(root);
  if (idx < 0) return null;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return KEYS[newIdx] + (suffix ? ' ' + suffix : '');
}

/**
 * `highlightChar` (optional): startChar of a note to mark as "playing now" —
 * the practice card's follow-along cursor for the generated backing.
 */
export function AbcViewer({ abc, transpose = 0, onTransposeChange, savedTranspose, onSave, highlightChar = null }) {
  const [localTranspose, setLocalTranspose] = useState(0);
  const t = onTransposeChange ? transpose : localTranspose;
  const setT = onTransposeChange || setLocalTranspose;

  const ref = useRef();
  const tuneRef = useRef(null);
  const [renderCount, setRenderCount] = useState(0);
  useEffect(() => {
    if (ref.current && abc) {
      tuneRef.current = abcjs.renderAbc(ref.current, abc, {
        responsive: 'resize',
        add_classes: true,
        visualTranspose: t,
      })[0] || null;
      setRenderCount(n => n + 1);
    }
  }, [abc, t]);

  // Mark the playing note (no scrolling — the page stays where the user put it).
  useEffect(() => {
    const tune = tuneRef.current;
    if (highlightChar == null || !tune) return;
    const els = tune.getElementFromChar(highlightChar)?.abselem?.elemset || [];
    for (const el of els) el.classList.add('abc-cursor');
    return () => { for (const el of els) el.classList.remove('abc-cursor'); };
  }, [highlightChar, renderCount]);

  if (!abc) {
    return <p class="text-gray-400 italic">No ABC notation available</p>;
  }

  const { isOffline } = useConnectivity();
  const dirty = onSave && t !== (savedTranspose ?? 0);
  const keyName = transposedKeyName(abc, t);

  return (
    <div class="relative">
      <div class="absolute top-0 right-0 flex items-center gap-1 z-10">
        {dirty && (
          <button
            onClick={() => onSave(t)}
            disabled={isOffline}
            title={isOffline ? 'Unavailable offline' : undefined}
            class="text-[11px] text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >save</button>
        )}
        <span class="text-[11px] text-gray-400">{keyName || 'transpose'}</span>
        <button
          onClick={() => setT(t + 1)}
          class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-1"
          title="Transpose up"
        >+</button>
        <button
          onClick={() => setT(t - 1)}
          class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-1"
          title="Transpose down"
        >-</button>
      </div>
      <div ref={ref} class="abc-viewer" />
    </div>
  );
}
