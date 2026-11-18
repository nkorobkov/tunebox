import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { arrange } from '../../lib/backing/arrange';
import { DEFAULT_PREFS } from '../../lib/backing/prefs';
import { loopPasses, loopRegion, loopLabel } from '../../lib/backing/loop-units';
import { usePlanPlayer, occAt } from '../../hooks/use-plan-player';

const MELODY_ONLY = { melody: 60, chords: 0, bass: 0, drums: 0, drone: 0 };

/**
 * The tune's melody on its own, played through the backing engine at the
 * card's tempo, with an optional loop over a stretch of the tune as played
 * (see lib/backing/loop-units). `soundPrefs` are the backing's settings —
 * only the melody instrument and swing are used, so the tune sounds the same
 * with or without the band. `looping` (the practice sound's Loop mode) makes
 * it repeat — the selected bars, or the whole tune with nothing selected;
 * otherwise it plays the tune through once.
 */
export function useTunePlayer({ abc, model, tempo, transpose, soundPrefs, tuneType, looping = false }) {
  const melody = soundPrefs?.melody || DEFAULT_PREFS.melody;
  const swing = soundPrefs?.swing || DEFAULT_PREFS.swing;

  // The melody-only arrangement doesn't depend on tempo (its times are whole
  // notes), so it's built once and only the tempo is swapped in.
  const base = useMemo(() => {
    if (!abc || !model) return null;
    try {
      return arrange({
        abc, model, chordValues: model.bars.map(() => ''), tempo: 120, transpose, tuneType,
        prefs: { ...DEFAULT_PREFS, melody, swing, volumes: MELODY_ONLY, countIn: false },
      });
    } catch (err) {
      console.error('Tune arrangement failed:', err);
      return null;
    }
  }, [abc, model, transpose, melody, swing, tuneType]);
  const plan = useMemo(() => (base && tempo ? { ...base, wholeSec: 240 / tempo } : null), [base, tempo]);

  const layout = useMemo(() => loopPasses(base, model), [base, model]);
  const [selection, setSelection] = useState(null); // { a, b, pending } unit indices
  useEffect(() => {
    if (selection && (!layout || Math.max(selection.a, selection.b) >= layout.units.length)) setSelection(null);
  }, [layout]);

  const selected = useMemo(() => loopRegion(layout, selection), [layout, selection?.a, selection?.b]);
  const region = looping ? selected : null;
  // a loop goes straight round, with no count-in
  const playback = usePlanPlayer(plan, { loop: looping, region, countIn: false });

  // Tap a start bar, then an end bar; a tap after that starts a new loop.
  const tapUnit = (u) => setSelection(sel => {
    if (!sel || !sel.pending) return { a: u, b: u, pending: true };
    if (u === sel.a) return null;
    return { a: Math.min(sel.a, u), b: Math.max(sel.a, u), pending: false };
  });
  const tapPass = (p) => {
    const ids = layout.passes[p].units;
    const a = ids[0];
    const b = ids[ids.length - 1];
    setSelection(sel => (sel && !sel.pending && sel.a === a && sel.b === b ? null : { a, b, pending: false }));
  };

  return {
    available: !!layout,
    ready: !!plan,
    ...playback,
    layout,
    timeline: plan?.timeline || null,
    wholeSec: plan?.wholeSec || null,
    selection,
    looping,
    region,
    loopName: loopLabel(layout, selection),
    tapUnit,
    tapPass,
    clearLoop: () => setSelection(null),
  };
}

export function LoopIcon({ class: cls }) {
  return (
    <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/**
 * The tune as played, one segment per pass (A1 A2 B1 B2), with the loop
 * region marked and the playhead animated straight on the DOM (no
 * re-render per frame). Tapping jumps to that bar when nothing is looped.
 */
export function ProgressTrack({ player }) {
  const { layout, region, timeline, wholeSec } = player;
  const span = layout.end - layout.start;
  const frac = (p) => Math.max(0, Math.min(1, (p - layout.start) / span));
  const pct = (p) => `${frac(p) * 100}%`;
  const fillRef = useRef(null);
  const timeRef = useRef(null);
  const idle = player.status === 'idle';

  useEffect(() => {
    let raf;
    const draw = () => {
      const head = player.playhead();
      // counting in: hold at the loop's start
      const pos = head ? head.pos ?? region?.start ?? layout.start : layout.start;
      if (fillRef.current) fillRef.current.style.width = pct(pos);
      // playing: time into the tune; idle: its length at this tempo
      if (timeRef.current) {
        timeRef.current.textContent = head ? fmt((pos - layout.start) * head.plan.wholeSec) : wholeSec ? fmt(span * wholeSec) : '';
      }
      if (head) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [player.status, layout, region?.start, wholeSec]);

  // Tap to jump to a bar — only when nothing is looped.
  const seekable = !region && player.status !== 'loading';
  const onClick = (e) => {
    if (!seekable || !timeline) return;
    const box = e.currentTarget.getBoundingClientRect();
    const occ = occAt(timeline, layout.start + ((e.clientX - box.left) / box.width) * span);
    const from = timeline[occ ?? 0].start;
    if (idle) player.play(from); else player.seek(from);
  };

  return (
    <div class="flex-1 min-w-0 flex items-end gap-2">
      <div onClick={onClick} class={`relative flex-1 h-9 select-none ${seekable ? 'cursor-pointer' : ''}`}>
        {layout.passes.map(p => (
          <span
            key={p.index}
            class="absolute top-0 text-[10px] font-semibold leading-none text-gray-400 pl-0.5"
            style={{ left: pct(p.start) }}
          >{p.label}</span>
        ))}
        {region && (
          <div
            class="absolute top-3.5 bottom-0 rounded-md bg-brand-100 border border-brand-600"
            style={{ left: `calc(${pct(region.start)} - 3px)`, width: `calc(${(frac(region.end) - frac(region.start)) * 100}% + 6px)` }}
          />
        )}
        <div class="absolute left-0 right-0 bottom-[7px] h-2 rounded-full bg-gray-200 overflow-hidden">
          <div ref={fillRef} class="h-full bg-brand-600" style={{ width: '0%' }} />
          {layout.passes.slice(1).map(p => (
            <span key={p.index} class="absolute top-0 bottom-0 w-0.5 -ml-px bg-white" style={{ left: pct(p.start) }} />
          ))}
        </div>
      </div>
      <span class="w-9 shrink-0 text-right text-xs text-gray-400 pb-0.5" style="font-variant-numeric: tabular-nums">
        {/* written only by the draw loop: mixing rendered and DOM-written text in one node garbles it */}
        <span ref={timeRef} title={idle ? 'Length at this tempo' : undefined} />
      </span>
    </div>
  );
}

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One line per pass of bar boxes (like the chord chart); tap a start and an end bar, or a pass to loop all of it. */
export function LoopPicker({ player }) {
  const { layout, selection, activeOcc, tapUnit, tapPass } = player;
  const lo = selection ? Math.min(selection.a, selection.b) : -1;
  const hi = selection ? Math.max(selection.a, selection.b) : -1;
  const passSelected = (p) => {
    const ids = layout.passes[p].units;
    return selection && !selection.pending && lo === ids[0] && hi === ids[ids.length - 1];
  };

  return (
    <div class="border-t border-gray-100 pt-3 space-y-2">
      <div class="space-y-1.5">
        {layout.passes.map(pass => (
          <div key={pass.index} class="flex items-start gap-1.5">
            <button
              onClick={() => tapPass(pass.index)}
              title={`Loop ${pass.label}`}
              class={`w-9 shrink-0 h-9 rounded-md text-xs font-semibold cursor-pointer border ${
                passSelected(pass.index) ? 'bg-brand-600 border-brand-600 text-white' : 'border-transparent text-gray-500 hover:bg-gray-100'
              }`}
            >{pass.label}</button>
            <div class="flex-1 grid gap-1" style="grid-template-columns: repeat(8, minmax(0, 1fr))">
              {pass.units.map(id => {
                const u = layout.units[id];
                const on = id >= lo && id <= hi;
                const playing = activeOcc !== null && u.occs.includes(activeOcc);
                return (
                  <button
                    key={id}
                    onClick={() => tapUnit(id)}
                    title={u.first === u.last ? `${pass.label} bar ${u.first}` : `${pass.label} bars ${u.first}–${u.last}`}
                    class={`relative h-9 min-w-0 rounded-md border text-xs font-medium cursor-pointer flex items-center justify-center ${
                      on ? 'bg-brand-600 border-brand-600 text-white'
                        : playing ? 'border-brand-600 bg-brand-50 text-gray-900'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    } ${on && selection.pending ? 'ring-2 ring-brand-300' : ''}`}
                  >
                    {u.ending && <span class={`absolute top-0.5 left-1 text-[9px] leading-none ${on ? 'text-white/80' : 'text-gray-400'}`}>{u.ending}.</span>}
                    {u.first === u.last ? u.first : `${u.first}–${u.last}`}
                    {playing && on && <span class="absolute bottom-1 left-1/2 -ml-0.5 w-1 h-1 rounded-full bg-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div class="flex items-center justify-end gap-3">
        <span class="text-xs text-gray-400 mr-auto">
          {selection?.pending ? 'Tap an end bar, or play this one' : selection ? 'Tap a bar to start a new loop' : 'Looping the whole tune · tap a start bar, then an end bar'}
        </span>
      </div>
    </div>
  );
}
