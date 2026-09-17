import { useState, useRef, useEffect } from 'preact/hooks';

/**
 * The "N remaining" counter in the practice header, doubling as a peek at
 * the rest of the queue. Picking a tune pulls it forward to practise now —
 * the one on screen becomes the next item rather than being dropped.
 * `items` are the queue entries still waiting (the current one excluded).
 */
export function QueueMenu({ items, onJump }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (id) => {
    setOpen(false);
    onJump(id);
  };

  return (
    <div class="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer flex items-center gap-1"
      >
        {items.length} remaining
        <span class={`text-[10px] inline-block transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div
          role="menu"
          class="absolute right-0 top-full mt-2 z-30 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          <p class="px-3 py-1.5 text-xs text-gray-400">Up next — tap to practise now</p>
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => pick(item.id)}
              role="menuitem"
              class="block w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <span class="flex items-baseline gap-2">
                <span class="text-xs text-gray-400 w-4 shrink-0" style="font-variant-numeric: tabular-nums">{i + 1}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm text-gray-800 truncate">
                    {item.kind === 'set' ? item.name : item.tune.title}
                  </span>
                  {item.kind === 'set' ? (
                    <span class="block text-xs text-gray-400 truncate">Set · {item.tunes.length} tunes</span>
                  ) : (
                    <span class="block text-xs text-gray-400 truncate capitalize">{item.tune.type || 'tune'}</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
