import { useState, useEffect, useRef } from 'preact/hooks';
import {
  barSlots, joinSlots, canSplit, keyPalette, keyName, transposeKey, transposeChordName,
  parseChord, NO_CHORD,
} from '../../lib/backing/chords';

/**
 * Compact chord chart — one chip per bar, a row per part — with an inline
 * editor under it for the selected bar. Chords are stored in the written
 * key; with a transpose set, everything is shown (and entered) in the
 * sounding key and converted back on the way in.
 */
export function ChordChart({ model, chords, suggested, onChange, transpose = 0, activeBar = null }) {
  const [selected, setSelected] = useState(null);
  const shownKey = (bar) => transposeKey(bar.key, transpose);
  const show = (name, bar) => (name && name !== NO_CHORD ? transposeChordName(name, transpose, shownKey(bar).flats) : name);

  useEffect(() => {
    if (selected !== null && selected >= model.bars.length) setSelected(null);
  }, [model, selected]);

  const editable = (bar) => !bar.pickup;

  // Keep the playing bar in view inside the sideways-scrolling chart
  // (horizontal only — never scroll the page).
  const scrollRef = useRef(null);
  useEffect(() => {
    const box = scrollRef.current;
    const chip = activeBar !== null && box?.querySelector(`[data-bar="${activeBar}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft + 24 || left + chip.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: Math.max(0, left - 32), behavior: 'smooth' });
    }
  }, [activeBar]);

  return (
    <div class="space-y-2">
      {/* One line per part; a part wider than the screen scrolls sideways
          inside this box rather than wrapping (or widening the page). */}
      <div ref={scrollRef} class="relative overflow-x-auto overscroll-x-contain max-w-full pb-1">
       <div class="w-max min-w-full space-y-1.5">
        {model.parts.map(part => {
          const bars = part.bars.map(i => model.bars[i]).filter(editable);
          if (!bars.length) return null;
          return (
            <div key={part.index} class="flex items-start gap-1.5">
              <span class="sticky left-0 z-10 w-5 shrink-0 self-stretch pt-2 text-[11px] font-semibold text-gray-400 bg-white">{part.label}</span>
              <div class="flex gap-1">
                {bars.map(bar => (
                  <BarChip
                    key={bar.index}
                    bar={bar}
                    slots={barSlots(chords[bar.index]).map(s => show(s, bar))}
                    edited={chords[bar.index] !== suggested?.[bar.index]}
                    selected={selected === bar.index}
                    playing={activeBar === bar.index}
                    onClick={() => setSelected(selected === bar.index ? null : bar.index)}
                  />
                ))}
              </div>
            </div>
          );
        })}
       </div>
      </div>
      {selected !== null && model.bars[selected] && (
        <BarEditor
          model={model}
          bar={model.bars[selected]}
          value={chords[selected]}
          shownKey={shownKey(model.bars[selected])}
          transpose={transpose}
          onChange={(v) => onChange(selected, v)}
          onMove={(dir) => {
            let i = selected + dir;
            while (model.bars[i] && !editable(model.bars[i])) i += dir;
            if (model.bars[i]) setSelected(i);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BarChip({ bar, slots, edited, selected, playing, onClick }) {
  const label = (s) => (s === '' ? '%' : s);
  const dim = (s) => s === '' || s === NO_CHORD;
  return (
    <button
      onClick={onClick}
      title={`Bar ${bar.index + 1}`}
      data-bar={bar.index}
      class={`relative h-9 w-[4.5rem] shrink-0 px-1 rounded-md border text-sm font-medium cursor-pointer flex items-center justify-center gap-1 ${
        selected ? 'border-blue-600 ring-1 ring-blue-600 bg-white'
          : playing ? 'border-brand-600 bg-brand-50'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      } ${bar.partial ? 'opacity-80' : ''}`}
    >
      {bar.ending && <span class="absolute top-0 left-1 text-[9px] leading-none text-gray-400">{bar.ending}.</span>}
      {slots.map((s, i) => (
        <span key={i} class={`truncate ${dim(s) ? 'text-gray-400' : 'text-gray-900'} ${slots.length > 1 ? 'text-xs' : ''}`}>
          {i > 0 && <span class="text-gray-300 mr-1">·</span>}{label(s)}
        </span>
      ))}
      {edited && <span class="absolute top-1 right-1 w-1 h-1 rounded-full bg-blue-600" title="Changed from the suggestion" />}
    </button>
  );
}

function BarEditor({ model, bar, value, shownKey, transpose, onChange, onMove, onClose }) {
  const slots = barSlots(value);
  const split = slots.length === 2;
  const [half, setHalf] = useState(0);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState(false);
  useEffect(() => { setHalf(0); setCustom(''); setCustomError(false); }, [bar.index]);

  const palette = keyPalette(shownKey);
  const toStored = (name) => (name && name !== NO_CHORD ? transposeChordName(name, -transpose, bar.key.flats) : name);
  const toShown = (name) => (name && name !== NO_CHORD ? transposeChordName(name, transpose, shownKey.flats) : name);
  const current = toShown(slots[split ? half : 0]);

  const set = (shownName) => {
    const stored = toStored(shownName);
    if (!split) onChange(stored);
    else onChange(joinSlots(half === 0 ? [stored, slots[1]] : [slots[0], stored]));
  };

  const toggleSplit = () => {
    if (split) onChange(slots[0] || slots[1]);
    else {
      // written raw: joinSlots would collapse two equal halves back into one
      const a = slots[0] || '%';
      onChange(`${a} ${a}`);
      setHalf(1);
    }
  };

  const applyCustom = (e) => {
    e.preventDefault();
    const name = custom.trim();
    if (!parseChord(name)) { setCustomError(true); return; }
    set(name);
    setCustom('');
    setCustomError(false);
  };

  const chipClass = (active) => `px-2.5 py-1.5 rounded-md text-sm font-medium cursor-pointer border ${
    active ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
  }`;

  return (
    <div class="rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 space-y-2">
      <div class="flex items-center gap-2">
        <button onClick={() => onMove(-1)} class="h-7 w-7 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer" aria-label="Previous bar">‹</button>
        <span class="text-sm font-medium text-gray-700">
          Bar {bar.index + 1}{bar.ending ? ` · ending ${bar.ending}` : ''}
        </span>
        <button onClick={() => onMove(1)} class="h-7 w-7 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 cursor-pointer" aria-label="Next bar">›</button>
        <span class="text-xs text-gray-400 ml-auto">{keyName(shownKey)}</span>
        <button onClick={onClose} class="h-7 w-7 rounded-md text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Close chord editor">✕</button>
      </div>

      {canSplit(model, bar) && (
        <div class="flex items-center gap-1 text-xs">
          <button onClick={toggleSplit} class={`px-2 py-1 rounded cursor-pointer ${!split ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>Whole bar</button>
          <button onClick={() => !split && toggleSplit()} class={`px-2 py-1 rounded cursor-pointer ${split ? 'bg-gray-800 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>Two halves</button>
          {split && (
            <span class="ml-2 flex items-center gap-1">
              {[0, 1].map(h => (
                <button
                  key={h}
                  onClick={() => setHalf(h)}
                  class={`px-2 py-1 rounded cursor-pointer border ${half === h ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500'}`}
                >{h === 0 ? '1st' : '2nd'}: {toShown(slots[h]) || '%'}</button>
              ))}
            </span>
          )}
        </div>
      )}

      <div class="flex flex-wrap gap-1">
        {palette.main.map(n => <button key={n} onClick={() => set(n)} class={chipClass(current === n)}>{n}</button>)}
      </div>
      <div class="flex flex-wrap items-center gap-1">
        {palette.extras.map(n => <button key={n} onClick={() => set(n)} class={chipClass(current === n)}>{n}</button>)}
        <button onClick={() => set('')} class={chipClass(current === '')} title="Keep the previous chord going">%</button>
        <button onClick={() => set(NO_CHORD)} class={chipClass(current === NO_CHORD)} title="No chord in this bar">N.C.</button>
        <form onSubmit={applyCustom} class="flex items-center gap-1">
          <input
            value={custom}
            onInput={e => { setCustom(e.target.value); setCustomError(false); }}
            placeholder="Other…"
            aria-label="Custom chord"
            class={`w-20 px-2 py-1.5 rounded-md border text-sm bg-white ${customError ? 'border-red-400' : 'border-gray-300'}`}
          />
          {custom && <button type="submit" class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer px-1">Set</button>}
        </form>
      </div>
      {customError && <p class="text-xs text-red-600">Not a chord name — try forms like D, Am, G7, F#m, C/E.</p>}
    </div>
  );
}
