export function PlayIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function StopIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

export function WaveformIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M4 10v4" />
      <path d="M8 7v10" />
      <path d="M12 4v16" />
      <path d="M16 7v10" />
      <path d="M20 10v4" />
    </svg>
  );
}

/**
 * Equal-size tile for the playback tool row (play tune / backing track).
 * `corner` renders a small secondary control in the top-right (loop toggle)
 * outside the main button.
 */
export function ToolTile({ active, onClick, disabled, icon, label, sublabel, corner }) {
  return (
    <div class={`relative rounded-lg border ${active ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={onClick}
        disabled={disabled}
        class="w-full pt-5 pb-2.5 px-2 flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class={active ? 'text-brand-700 dark:text-brand-400' : 'text-gray-500'}>{icon}</span>
        <span class={`text-sm font-medium ${active ? 'text-brand-800 dark:text-brand-300' : 'text-gray-700'}`}>{label}</span>
        <span class={`text-xs ${active ? 'text-brand-700 dark:text-brand-400' : 'text-gray-400'}`}>{sublabel}</span>
      </button>
      {corner && <div class="absolute top-1 right-1">{corner}</div>}
    </div>
  );
}
