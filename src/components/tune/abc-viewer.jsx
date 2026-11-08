import { useState, useRef, useEffect, useMemo } from 'preact/hooks';
import abcjs from 'abcjs';
import { useConnectivity } from '../../lib/connectivity';
import { parseBars } from '../../lib/backing/abc-bars';

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
 * `cursorKey` (optional): the note playing now as "bar:off" (written bar +
 * offset, from the generated backing or AbcPlayer's `onCursor`) — marked with
 * a red note and a band. Keyed by bar rather than startChar because the
 * player's ABC and this one can differ (tempo header, chord symbols).
 */
export function AbcViewer({ abc, transpose = 0, onTransposeChange, savedTranspose, onSave, cursorKey = null }) {
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

  const charAt = useMemo(() => {
    const map = new Map();
    const model = abc ? parseBars(abc) : null;
    if (model) for (const [char, { bar, off }] of model.charMap) map.set(`${bar}:${off}`, char);
    return map;
  }, [abc]);
  const highlightChar = cursorKey ? charAt.get(cursorKey) ?? null : null;

  // Mark the playing note: colour it and lay a band behind it spanning the
  // staff (no scrolling — the page stays where the user put it).
  useEffect(() => {
    const tune = tuneRef.current;
    if (highlightChar == null || !tune) return;
    const els = tune.getElementFromChar(highlightChar)?.abselem?.elemset || [];
    for (const el of els) el.classList.add('abc-cursor');
    const band = addCursorBand(els);
    return () => {
      for (const el of els) el.classList.remove('abc-cursor');
      band?.remove();
    };
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

// A translucent rect behind the note, the note's width (plus padding) and the
// height of its staff, inserted first in the staff line's group so it sits
// under the notation. abcjs draws each line as an untransformed
// g.abcjs-staff-wrapper, so bounding boxes share its coordinates.
function addCursorBand(els) {
  const note = els.find(el => /abcjs-(note|rest)\b/.test(el.getAttribute('class') || '')) || els[0];
  const wrapper = note?.closest('.abcjs-staff-wrapper');
  if (!wrapper) return null;
  const nb = note.getBBox();
  const sb = wrapper.querySelector('.abcjs-staff')?.getBBox() || nb;
  const top = Math.min(sb.y, nb.y) - 6;
  const bottom = Math.max(sb.y + sb.height, nb.y + nb.height) + 6;
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', 'abc-cursor-band');
  rect.setAttribute('x', nb.x - 4);
  rect.setAttribute('y', top);
  rect.setAttribute('width', nb.width + 8);
  rect.setAttribute('height', bottom - top);
  rect.setAttribute('rx', 3);
  wrapper.insertBefore(rect, wrapper.firstChild);
  return rect;
}
