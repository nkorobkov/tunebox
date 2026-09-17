import { useState, useRef, useEffect } from 'preact/hooks';

const MAX_OPTIONS = 3;

/**
 * Tag/set name entry with autocomplete. Desktop gets inline ghost text
 * completed with → or Tab; touch gets a dropdown of the top few matches
 * under the field (no arrow keys on a phone keyboard), open whenever the
 * field is focused. With an empty field the list shows the most recently
 * used tags, which `getKnownTags()` already sorts to the front.
 */
export function TagInput({ value, onInput, onSubmit, onCancel, suggestions }) {
  const [matchIdx, setMatchIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const v = value.toLowerCase();
  const matches = value
    ? [
        ...suggestions.filter(s => s.toLowerCase().startsWith(v) && s.toLowerCase() !== v),
        ...suggestions.filter(s => !s.toLowerCase().startsWith(v) && s.toLowerCase().includes(v)),
      ]
    : suggestions;

  // Inline completion only kicks in once something is typed, and only for a
  // prefix match — the ghost text sits directly after what the user typed.
  // An empty field just lists its recent tags to tap.
  const suggestion = value ? (matches[matchIdx % matches.length] || null) : null;
  const suffix = suggestion && suggestion.toLowerCase().startsWith(v) ? suggestion.slice(value.length) : '';
  const options = matches.slice(0, MAX_OPTIONS);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // Reset match index when input changes
  useEffect(() => setMatchIdx(0), [value]);

  const pick = (s) => {
    onInput(s);
    onSubmit(s);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowRight' && suffix && inputRef.current.selectionStart === value.length) {
      e.preventDefault();
      onInput(suggestion);
    } else if (e.key === 'ArrowDown' && matches.length > 1) {
      e.preventDefault();
      setMatchIdx(i => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length > 1) {
      e.preventDefault();
      setMatchIdx(i => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Tab' && suffix) {
      e.preventDefault();
      onInput(suggestion);
    }
  };

  return (
    <div class="relative inline-block">
      {/* Ghost text layer */}
      <span
        class="absolute left-0 top-0 text-xs px-2 py-1 border border-transparent pointer-events-none whitespace-nowrap overflow-hidden"
        aria-hidden="true"
      >
        <span class="invisible">{value}</span>
        <span class="text-gray-300">{suffix}</span>
      </span>
      {/* Actual input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onInput={e => onInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Tag..."
        class="text-xs border border-gray-300 rounded px-2 py-1 w-28 bg-transparent relative"
      />
      {focused && options.length > 0 && (
        <ul
          // mousedown fires before blur — swallowing it keeps the field
          // focused so the list is still mounted when the click lands.
          onMouseDown={e => e.preventDefault()}
          role="listbox"
          class="absolute left-0 top-full mt-1 z-20 min-w-full max-w-56 bg-white border border-gray-200 rounded shadow-lg py-1 text-left"
        >
          {options.map(s => (
            <li key={s}>
              <button
                type="button"
                role="option"
                aria-selected={s === suggestion}
                onClick={() => pick(s)}
                class={`block w-full text-left text-xs px-2 py-1.5 truncate cursor-pointer hover:bg-gray-100 ${s === suggestion ? 'bg-gray-100 text-gray-900' : 'text-gray-600'}`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
