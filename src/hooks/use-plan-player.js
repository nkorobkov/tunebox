import { useState, useEffect, useRef } from 'preact/hooks';
import { BackingPlayer, renderPlan, unlockAudio } from '../lib/backing/engine';
import { claimPlayback, releasePlayback } from '../lib/exclusive-playback';

/**
 * Plays an arranged plan (lib/backing/arrange.js): renders it, re-renders
 * while playing when the plan changes (tempo, transpose, sound) and carries on
 * from the same bar, and follows the playing bar and note. Shared by the
 * generated backing and the practice card's tune player. Starting it stops any
 * other practice sound (exclusive-playback).
 *
 * `loop`: wrap at the loop end instead of stopping after the tune.
 * `region` ({ start, end } in whole notes, or null): the loop region — the
 * plan's whole tune when null. Changing it while playing moves the loop
 * seamlessly when the playhead is inside the new region, else restarts there
 * with a count-in. `countIn: false` never counts in when starting mid-tune
 * (the plan's own count-in, if it was arranged with one, still plays from 0).
 */
export function usePlanPlayer(plan, { loop = true, region = null, countIn = true } = {}) {
  const [status, setStatus] = useState('idle'); // idle | loading | playing
  const [playError, setPlayError] = useState(null);
  const [activeOcc, setActiveOcc] = useState(null); // index into plan.timeline
  const [cursorKey, setCursorKey] = useState(null); // "bar:off" of the melody note sounding now
  const playerRef = useRef(null);
  const bufferRef = useRef(null); // { plan, buffer }
  const renderId = useRef(0);
  const tokenRef = useRef({ stop: () => {} });

  const clearTracking = () => { setActiveOcc(null); setCursorKey(null); };
  if (!playerRef.current) {
    playerRef.current = new BackingPlayer(() => {
      setStatus('idle');
      clearTracking();
      releasePlayback(tokenRef.current);
    });
  }
  const player = playerRef.current;

  const loopOf = (p) => ({
    loop,
    loopStart: region ? region.start : p.loopStart,
    loopEnd: region ? region.end : p.loopEnd,
  });
  const inRegion = (pos) => !region || (pos >= region.start - 1e-6 && pos < region.end);

  useEffect(() => () => {
    player.stop();
    releasePlayback(tokenRef.current);
  }, []);

  // Re-render while playing when anything that shapes the sound changes, and
  // carry on from the same bar.
  useEffect(() => {
    if (status !== 'playing' || !plan || bufferRef.current?.plan === plan) return;
    const id = ++renderId.current;
    const t = setTimeout(async () => {
      try {
        const buffer = await renderPlan(plan);
        if (id !== renderId.current || !player.playing) return;
        let from = carryPosition(bufferRef.current?.plan, player.position(), plan);
        if (!inRegion(from)) from = region.start;
        bufferRef.current = { plan, buffer };
        player.start(buffer, plan, { from, ...loopOf(plan) });
      } catch (err) {
        console.error('Playback render failed:', err);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [plan, status]);

  // Loop switched or moved while playing.
  const regionKey = `${loop}:${region?.start}:${region?.end}`;
  useEffect(() => {
    if (status !== 'playing' || !player.playing || !player.plan) return;
    const want = loopOf(player.plan);
    if (want.loop === player.loop && want.loopStart === player.loopStart && want.loopEnd === player.loopEnd) return;
    if (player.setRegion(want)) return;
    // the playhead is outside the new region: start it again from there
    const t = setTimeout(() => {
      const current = bufferRef.current;
      if (!player.playing || !current || !region) return;
      player.start(current.buffer, current.plan, { from: region.start, countIn, ...loopOf(current.plan) });
    }, 300);
    return () => clearTimeout(t);
  }, [regionKey, status]);

  // follow the playing bar and note; a tune that doesn't loop stops once it's over
  useEffect(() => {
    if (status !== 'playing') return;
    let raf;
    const tick = () => {
      const p = player.position();
      const current = bufferRef.current?.plan;
      if (p === null || !current || player.counting) {
        clearTracking();
      } else {
        setActiveOcc(occAt(current.timeline, p));
        const note = noteAt(current.cursor, p);
        setCursorKey(note ? `${note.bar}:${note.off}` : null);
        if (!player.loop && p > current.loopEnd + current.barLength / 2) {
          stop();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  /** Start playing — from `from` (whole notes; with a bar's count-in unless off), else from the region or the top. */
  const play = async (from = null) => {
    if (!plan) return;
    unlockAudio(); // synchronously, inside the tap
    claimPlayback(tokenRef.current);
    setPlayError(null);
    setStatus('loading');
    const id = ++renderId.current;
    try {
      const buffer = bufferRef.current?.plan === plan ? bufferRef.current.buffer : await renderPlan(plan);
      if (id !== renderId.current) return;
      bufferRef.current = { plan, buffer };
      const start = from ?? (region ? region.start : 0);
      // a plan's own count-in sits at 0, before the music
      player.start(buffer, plan, { from: start, countIn: countIn && start > 0, ...loopOf(plan) });
      setStatus('playing');
    } catch (err) {
      console.error('Playback render failed:', err);
      setPlayError(navigator.onLine === false ? 'Couldn’t load the instrument sounds offline.' : 'Couldn’t prepare the sound.');
      setStatus('idle');
      releasePlayback(tokenRef.current);
    }
  };

  /** Jump to `pos` (whole notes) while playing, without a count-in. */
  const seek = (pos) => {
    const current = bufferRef.current;
    if (!player.playing || !current) return;
    player.start(current.buffer, current.plan, { from: pos, ...loopOf(current.plan) });
  };

  const stop = () => {
    renderId.current++;
    player.stop();
    setStatus('idle');
    clearTracking();
    releasePlayback(tokenRef.current);
  };
  tokenRef.current.stop = stop;

  const timeline = bufferRef.current?.plan?.timeline || plan?.timeline;
  return {
    status,
    playError,
    play,
    stop,
    seek,
    activeOcc,
    activeBar: activeOcc === null || !timeline?.[activeOcc] ? null : timeline[activeOcc].bar,
    cursorKey,
    /** Live playhead for animation: { pos, plan } or null; pos is null while counting in. */
    playhead: () => {
      const current = bufferRef.current?.plan;
      if (!player.playing || !current) return null;
      return { pos: player.counting ? null : player.position(), plan: current };
    },
  };
}

// The melody note sounding at position p: the last one started, until the
// tune runs out (count-in and the ending tail show nothing).
function noteAt(cursor, p) {
  if (!cursor?.length || p < cursor[0].t) return null;
  let lo = 0;
  let hi = cursor.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cursor[mid].t <= p) lo = mid; else hi = mid - 1;
  }
  return cursor[lo];
}

/** Index of the bar occurrence playing at p, or null before the first. */
export function occAt(timeline, p) {
  if (!timeline?.length || p < timeline[0].start) return null;
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline[mid].start <= p) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// Where to resume in a re-rendered arrangement: the same bar occurrence, same
// distance into it (positions are in whole notes, so tempo changes carry over).
function carryPosition(oldPlan, p, newPlan) {
  if (!oldPlan || p === null) return 0;
  const tl = oldPlan.timeline;
  if (p < tl[0].start) return 0;
  let i = tl.length - 1;
  while (i > 0 && tl[i].start > p) i--;
  const target = newPlan.timeline[i];
  if (!target) return newPlan.loopStart;
  return Math.max(0, target.start + (p - tl[i].start));
}
