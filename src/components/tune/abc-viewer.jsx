import { useState } from 'preact/hooks';
import { useAbcRender } from '../../hooks/use-abc-render';

export function AbcViewer({ abc, transpose = 0, onTransposeChange, savedTranspose, onSave }) {
  const [localTranspose, setLocalTranspose] = useState(0);
  const t = onTransposeChange ? transpose : localTranspose;
  const setT = onTransposeChange || setLocalTranspose;

  const { ref } = useAbcRender(abc, { visualTranspose: t });

  if (!abc) {
    return <p class="text-gray-400 italic">No ABC notation available</p>;
  }

  const dirty = onSave && t !== (savedTranspose ?? 0);

  return (
    <div class="relative">
      <div class="absolute top-0 right-0 flex items-center gap-1 z-10">
        <button
          onClick={() => setT(t - 1)}
          class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-1"
          title="Transpose down"
        >-</button>
        <span class="text-[11px] text-gray-400">{t === 0 ? 'transpose' : `${t > 0 ? '+' : ''}${t}`}</span>
        <button
          onClick={() => setT(t + 1)}
          class="text-xs text-gray-400 hover:text-gray-600 cursor-pointer px-1"
          title="Transpose up"
        >+</button>
        {dirty && (
          <button
            onClick={() => onSave(t)}
            class="text-[11px] text-blue-600 hover:text-blue-700 cursor-pointer ml-1"
          >save</button>
        )}
      </div>
      <div ref={ref} class="abc-viewer" />
    </div>
  );
}
