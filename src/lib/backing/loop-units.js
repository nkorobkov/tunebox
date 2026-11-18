// The tune as it's played, for the practice card's loop picker and progress
// track: one *pass* per time a part is played (A1 A2 B1 B2 — repeats and
// endings expanded, from an arranged plan's timeline), each split into loop
// *units*. A unit is one bar — 8 notes of a reel, 6 of a jig — or two bars
// when bars are shorter than 6 eighths (polkas), so the smallest loop is
// always about a phrase-fragment's worth of notes.

const EPS = 1e-6;

/**
 * @returns { passes: [{ index, label, start, end, units: [unit indices] }],
 *   units: [{ index, pass, first, last (bar numbers within the pass, 1-based),
 *   occs: [timeline indices], start, end (whole notes), ending }],
 *   start, end } — null without a playable timeline.
 */
export function loopPasses(plan, model) {
  const tl = plan?.timeline;
  if (!tl?.length || !model) return null;
  const unitBars = model.barLength * 8 < 6 - EPS ? 2 : 1;

  // split the timeline into passes: a new one at each part change or repeat
  const raw = [];
  let cur = null;
  tl.forEach((occ, i) => {
    const bar = model.bars[occ.bar];
    const prev = i > 0 ? tl[i - 1] : null;
    if (!cur || bar.part !== model.bars[prev.bar].part || occ.bar <= prev.bar) {
      cur = { part: bar.part, occs: [] };
      raw.push(cur);
    }
    // the opening pickup is played but can't be looped on its own
    if (!(i === 0 && bar.pickup)) cur.occs.push(i);
  });

  // A part written out twice instead of with repeat signs (Drowsy Maggie's
  // B on thesession) is played once: split it when its halves open alike.
  const playedOnce = (part) => raw.filter(r => r.part === part).length === 1;
  for (let i = raw.length - 1; i >= 0; i--) {
    const r = raw[i];
    if (!playedOnce(r.part) || !writtenOutRepeat(r.occs.map(o => model.bars[tl[o].bar]))) continue;
    const half = r.occs.length / 2;
    raw.splice(i, 1, { part: r.part, occs: r.occs.slice(0, half) }, { part: r.part, occs: r.occs.slice(half) });
  }

  const timesPlayed = {};
  raw.forEach(p => { timesPlayed[p.part] = (timesPlayed[p.part] || 0) + 1; });
  const seen = {};
  const occEnd = (i) => tl[i].start + model.bars[tl[i].bar].length;

  const passes = [];
  const units = [];
  for (const p of raw.filter(r => r.occs.length)) {
    seen[p.part] = (seen[p.part] || 0) + 1;
    const name = model.parts[p.part]?.label || String.fromCharCode(65 + p.part);
    const pass = {
      index: passes.length,
      label: timesPlayed[p.part] > 1 ? `${name}${seen[p.part]}` : name,
      start: tl[p.occs[0]].start,
      end: occEnd(p.occs[p.occs.length - 1]),
      units: [],
    };
    for (let k = 0; k < p.occs.length; k += unitBars) {
      const occs = p.occs.slice(k, k + unitBars);
      const unit = {
        index: units.length,
        pass: pass.index,
        first: k + 1,
        last: k + occs.length,
        occs,
        start: tl[occs[0]].start,
        end: occEnd(occs[occs.length - 1]),
        ending: occs.map(i => model.bars[tl[i].bar].ending).find(Boolean) || null,
      };
      units.push(unit);
      pass.units.push(unit.index);
    }
    passes.push(pass);
  }
  if (!units.length) return null;
  return { passes, units, start: tl[0].start, end: units[units.length - 1].end };
}

// Halves of an even run of 8+ bars that share at least half of their bars
// (all but the last, where the endings differ), note for note.
function writtenOutRepeat(bars) {
  const n = bars.length;
  if (n < 8 || n % 2) return false;
  const half = n / 2;
  const sig = (bar) => bar.notes.map(x => `${x.pc}/${x.dur}/${x.off}`).join(' ');
  let same = 0;
  for (let i = 0; i < half - 1; i++) if (sig(bars[i]) === sig(bars[i + half])) same++;
  return same >= (half - 1) / 2;
}

/** The loop region (whole notes) of a selection { a, b } of unit indices. */
export function loopRegion(layout, sel) {
  if (!layout || !sel) return null;
  const a = layout.units[Math.min(sel.a, sel.b)];
  const b = layout.units[Math.max(sel.a, sel.b)];
  return a && b ? { start: a.start, end: b.end } : null;
}

/** Short name for a selection: "B1", "A2–B1", "A1 3–4", "A2 7 – B1 2". */
export function loopLabel(layout, sel) {
  if (!layout || !sel) return '';
  const a = layout.units[Math.min(sel.a, sel.b)];
  const b = layout.units[Math.max(sel.a, sel.b)];
  if (!a || !b) return '';
  const pa = layout.passes[a.pass];
  const pb = layout.passes[b.pass];
  const wholePasses = a.index === pa.units[0] && b.index === pb.units[pb.units.length - 1];
  if (wholePasses) return pa === pb ? pa.label : `${pa.label}–${pb.label}`;
  if (pa === pb) return a.first === b.last ? `${pa.label} bar ${a.first}` : `${pa.label} bars ${a.first}–${b.last}`;
  return `${pa.label} ${a.first} – ${pb.label} ${b.last}`;
}
