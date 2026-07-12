import { useState, useRef, useEffect } from 'preact/hooks';

// Ratings collapse into three status classes; colors live in index.css as
// --chart-* variables (validated for CVD separation and contrast against
// both card surfaces). "Hard" dots are hollow so state never rides on hue alone.
const RATING_CLASS = (r) => (r >= 4 ? 'good' : r >= 2 ? 'hard' : 'bad');
const RATING_WORD = { 5: 'Easy', 4: 'Good', 3: 'OK', 2: 'Hard', 1: 'Relearn' };

const H = 96;
const PAD_TOP = 16;
const PAD_BOTTOM = 16;
const LEFT = 34;
const RIGHT = 10;

function useContainerWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(es => setWidth(es[0].contentRect.width));
    ro.observe(ref.current);
    setWidth(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return width;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function yTicks(lo, hi) {
  const step = [5, 10, 20, 40, 60, 80].find(s => (hi - lo) / s <= 3.5) || 100;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
}

function Dot({ x, y, cls }) {
  return (
    <>
      {/* surface ring keeps the mark legible over the line */}
      <circle cx={x} cy={y} r={6} style="fill: var(--chart-surface)" />
      {cls === 'hard'
        ? <circle cx={x} cy={y} r={3.5} stroke-width="2" style="fill: var(--chart-surface); stroke: var(--chart-hard)" />
        : <circle cx={x} cy={y} r={4} style={`fill: var(--chart-${cls})`} />}
    </>
  );
}

/**
 * Compact tempo-over-practices chart: one dot per past practice (status color
 * by fluency rating), a connecting line, and a dashed target-tempo threshold.
 */
export function PracticeHistoryChart({ entries, targetTempo }) {
  if (!entries || entries.length === 0) return null;
  const points = entries.filter(e => e.tempo_used > 0);
  if (points.length === 0) return null;
  // Inner component so the width-measuring effect runs on a mounted container.
  return <Chart points={points} targetTempo={targetTempo} />;
}

function Chart({ points, targetTempo }) {
  const containerRef = useRef(null);
  const width = useContainerWidth(containerRef);
  const [hover, setHover] = useState(null);

  const tempos = points.map(e => e.tempo_used);
  const vals = targetTempo > 0 ? [...tempos, targetTempo] : tempos;
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 10) { lo -= (10 - (hi - lo)) / 2; hi = lo + 10; }
  const pad = Math.max(3, (hi - lo) * 0.12);
  const domLo = lo - pad;
  const domHi = hi + pad;

  const plotW = Math.max(0, width - LEFT - RIGHT);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const y = (v) => PAD_TOP + ((domHi - v) / (domHi - domLo)) * plotH;
  // X is scaled to time, so gaps between practices read as gaps.
  const times = points.map(e => new Date(e.practiced_at).getTime());
  const t0 = Math.min(...times);
  const span = Math.max(1, Math.max(...times) - t0);
  const x = (i) => points.length === 1 ? LEFT + plotW / 2 : LEFT + ((times[i] - t0) / span) * plotW;

  const classes = new Set(points.map(e => RATING_CLASS(e.fluency_rating)));
  const firstDate = fmtDate(points[0].practiced_at);
  const lastDate = fmtDate(points[points.length - 1].practiced_at);
  const last = points[points.length - 1];
  const lastLabelAbove = y(last.tempo_used) - 8 > PAD_TOP;

  const linePath = points.map((e, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(e.tempo_used).toFixed(1)}`).join(' ');

  return (
    <div class="practice-chart bg-white rounded-lg border border-gray-200 px-3 pt-2 pb-1">
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-400">Practice history</span>
        {classes.size > 1 && (
          <span class="flex items-center gap-2.5 text-[10px] text-gray-400">
            {classes.has('good') && <span class="flex items-center gap-1"><svg width="8" height="8"><circle cx="4" cy="4" r="3.5" style="fill: var(--chart-good)" /></svg>good</span>}
            {classes.has('hard') && <span class="flex items-center gap-1"><svg width="8" height="8"><circle cx="4" cy="4" r="2.5" stroke-width="1.5" style="fill: none; stroke: var(--chart-hard)" /></svg>hard</span>}
            {classes.has('bad') && <span class="flex items-center gap-1"><svg width="8" height="8"><circle cx="4" cy="4" r="3.5" style="fill: var(--chart-bad)" /></svg>relearn</span>}
          </span>
        )}
      </div>
      <div ref={containerRef} class="relative">
        {width > 0 && (
          <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} class="block">
            {yTicks(domLo, domHi).map(v => (
              <g key={v}>
                <line x1={LEFT} x2={width - RIGHT} y1={y(v)} y2={y(v)} class="stroke-gray-200" stroke-width="1" />
                <text x={LEFT - 6} y={y(v)} text-anchor="end" dominant-baseline="middle" class="fill-gray-400" font-size="9" style="font-variant-numeric: tabular-nums">{v}</text>
              </g>
            ))}
            {targetTempo > 0 && (
              <g>
                <line x1={LEFT} x2={width - RIGHT} y1={y(targetTempo)} y2={y(targetTempo)} class="stroke-gray-400" stroke-width="1" stroke-dasharray="4 3" />
                <text x={width - RIGHT} y={y(targetTempo) - 3} text-anchor="end" class="fill-gray-400" font-size="9">target {targetTempo}</text>
              </g>
            )}
            {points.length > 1 && (
              <path d={linePath} fill="none" class="stroke-gray-400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            )}
            {points.map((e, i) => <Dot key={e.id} x={x(i)} y={y(e.tempo_used)} cls={RATING_CLASS(e.fluency_rating)} />)}
            <text
              x={x(points.length - 1)}
              y={lastLabelAbove ? y(last.tempo_used) - 8 : y(last.tempo_used) + 15}
              text-anchor="end"
              class="fill-gray-700"
              font-size="10"
              font-weight="500"
            >{last.tempo_used}</text>
            {firstDate && points.length > 1 && (
              <text x={LEFT} y={H - 3} class="fill-gray-400" font-size="9">{firstDate}</text>
            )}
            {lastDate && lastDate !== firstDate && (
              <text x={width - RIGHT} y={H - 3} text-anchor="end" class="fill-gray-400" font-size="9">{lastDate}</text>
            )}
            {/* hover/focus hit layer — bigger than the dots */}
            {points.map((e, i) => (
              <circle
                key={`hit-${e.id}`}
                cx={x(i)}
                cy={y(e.tempo_used)}
                r={14}
                fill="transparent"
                tabIndex={0}
                aria-label={`${fmtDate(e.practiced_at)}: ${e.tempo_used} BPM, ${RATING_WORD[e.fluency_rating] || ''}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            ))}
          </svg>
        )}
        {hover !== null && points[hover] && (
          <div
            class="absolute z-10 px-2 py-1 rounded bg-gray-900 text-gray-50 text-xs whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
            style={{ left: `${Math.min(Math.max(x(hover), 50), width - 50)}px`, top: `${y(points[hover].tempo_used) - 8}px` }}
          >
            {fmtDate(points[hover].practiced_at)} · {points[hover].tempo_used} BPM
            {RATING_WORD[points[hover].fluency_rating] ? ` · ${RATING_WORD[points[hover].fluency_rating]}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
