import { useState, useRef, useEffect } from 'preact/hooks';

export function TagInput({ value, onInput, onSubmit, onCancel, suggestions }) {
  const [matchIdx, setMatchIdx] = useState(0);
  const inputRef = useRef(null);

  const matches = value
    ? suggestions.filter(s => s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
    : [];

  const suggestion = matches[matchIdx % matches.length] || null;
  const suffix = suggestion ? suggestion.slice(value.length) : '';

  useEffect(() => { inputRef.current?.focus(); }, []);
  // Reset match index when input changes
  useEffect(() => setMatchIdx(0), [value]);

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
        placeholder="Tag..."
        class="text-xs border border-gray-300 rounded px-2 py-1 w-28 bg-transparent relative"
      />
    </div>
  );
}
