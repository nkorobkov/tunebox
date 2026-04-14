import { useState } from 'preact/hooks';
import { useAbcRender } from '../../hooks/use-abc-render';

const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const KEY_MAP = { 'C#': 1, 'Db': 1, 'D#': 3, 'Eb': 3, 'F#': 6, 'Gb': 6, 'G#': 8, 'Ab': 8, 'A#': 10, 'Bb': 10 };

function transposedKeyName(abc, semitones) {
  const m = abc.match(/^K:\s*([A-G][b#]?)\s*(.*)/m);
  if (!m) return null;
  const root = m[1], suffix = m[2]; // suffix = "maj", "min", "m", "Dor", etc.
  const idx = KEY_MAP[root] ?? KEYS.indexOf(root);
  if (idx < 0) return null;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return KEYS[newIdx] + (suffix ? ' ' + suffix : '');
}

export function AbcViewer({ abc, transpose = 0, onTransposeChange, savedTranspose, onSave }) {
  const [localTranspose, setLocalTranspose] = useState(0);
  const t = onTransposeChange ? transpose : localTranspose;
  const setT = onTransposeChange || setLocalTranspose;

  const { ref } = useAbcRender(abc, { visualTranspose: t });

  if (!abc) {
    return <p class="text-gray-400 italic">No ABC notation available</p>;
  }

  const dirty = onSave && t !== (savedTranspose ?? 0);
  const keyName = transposedKeyName(abc, t);

  return (
    <div class="relative">
      <div class="absolute top-0 right-0 flex items-center gap-1 z-10">
        {dirty && (
          <button
            onClick={() => onSave(t)}
            class="text-[11px] text-blue-600 hover:text-blue-700 cursor-pointer"
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
