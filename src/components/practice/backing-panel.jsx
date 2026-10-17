import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { ChordChart } from './chord-chart';
import { PlayIcon, StopIcon } from './tool-tile';
import { arrange } from '../../lib/backing/arrange';
import { BackingPlayer, renderPlan, unlockAudio } from '../../lib/backing/engine';
import { loadPrefs, savePrefs, DEFAULT_PREFS, INSTRUMENTS, GUITARS, MELODY_INSTRUMENTS } from '../../lib/backing/prefs';
import {
  rhythmFamily, FAMILY_LABELS, STRUM_PATTERNS, PIANO_PATTERNS, SWING_LEVELS, swingSupported, swingValue,
} from '../../lib/backing/patterns';
import { keyName, transposeKey } from '../../lib/backing/chords';
import { claimPlayback, releasePlayback } from '../../lib/exclusive-playback';

const OFF = { id: 'off', label: 'Off' };
const BASS_STYLES = [{ id: 'root', label: 'Root' }, { id: 'rootFifth', label: 'Root–5th' }, { id: 'walking', label: 'Walking' }];
const DRONES = [{ id: 'tonic', label: 'Tonic' }, { id: 'fifth', label: 'Tonic + 5th' }];
const MIX = [['melody', 'Melody'], ['chords', 'Chords'], ['bass', 'Bass'], ['drums', 'Bodhrán'], ['drone', 'Drone']];

function usePrefs() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const update = (patch) => setPrefs(prev => {
    const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
    savePrefs(next);
    return next;
  });
  return [prefs, update];
}

/**
 * Generated backing for one tune: player, chord chart, and the arrangement
 * settings. `chordState` comes from useTuneChords (owned by the card, so the
 * sheet music can show the same chords).
 */
export function BackingPanel({ tune, abc, tempo, transpose, chordState }) {
  const { model, chords, suggested, setBar, resetToSuggested, save, saving, error, dirty, source, mismatch } = chordState;
  const [prefs, setPrefs] = usePrefs();
  const [status, setStatus] = useState('idle'); // idle | loading | playing
  const [playError, setPlayError] = useState(null);
  const [activeBar, setActiveBar] = useState(null);
  const playerRef = useRef(null);
  const bufferRef = useRef(null); // { plan, buffer }
  const renderId = useRef(0);

  const family = model ? rhythmFamily(model.meter, tune.type) : 'generic';

  // loop doesn't change the arrangement — keep it out of the plan's inputs
  const { loop, ...arrangePrefs } = prefs;
  const prefsKey = JSON.stringify(arrangePrefs);
  const plan = useMemo(() => {
    if (!model || !chords || !tempo) return null;
    try {
      return arrange({ abc, model, chordValues: chords, tempo, transpose, prefs: arrangePrefs, tuneType: tune.type });
    } catch (err) {
      console.error('Backing arrangement failed:', err);
      return null;
    }
  }, [abc, model, chords, tempo, transpose, prefsKey, tune.type]);

  // starting the backing stops the metronome, and vice versa
  const tokenRef = useRef({ stop: () => {} });
  if (!playerRef.current) {
    playerRef.current = new BackingPlayer(() => {
      setStatus('idle');
      setActiveBar(null);
      releasePlayback(tokenRef.current);
    });
  }
  const player = playerRef.current;

  useEffect(() => () => {
    player.stop();
    releasePlayback(tokenRef.current);
  }, []);
  useEffect(() => { player.setLoop(loop); }, [loop]);

  // Re-render while playing when anything that shapes the sound changes, and
  // carry on from the same bar.
  useEffect(() => {
    if (status !== 'playing' || !plan || bufferRef.current?.plan === plan) return;
    const id = ++renderId.current;
    const t = setTimeout(async () => {
      try {
        const buffer = await renderPlan(plan);
        if (id !== renderId.current || !player.playing) return;
        const from = carryPosition(bufferRef.current?.plan, player.position(), plan);
        bufferRef.current = { plan, buffer };
        player.start(buffer, plan, { from, loop });
      } catch (err) {
        console.error('Backing render failed:', err);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [plan, status]);

  // follow the playing bar on the chart
  useEffect(() => {
    if (status !== 'playing') return;
    let raf;
    const tick = () => {
      const p = player.position();
      const current = bufferRef.current?.plan;
      setActiveBar(p === null || !current ? null : barAt(current.timeline, p));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const play = async () => {
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
      player.start(buffer, plan, { from: 0, loop });
      setStatus('playing');
    } catch (err) {
      console.error('Backing render failed:', err);
      setPlayError(navigator.onLine === false ? 'Couldn’t load the instrument sounds offline.' : 'Couldn’t prepare the backing.');
      setStatus('idle');
      releasePlayback(tokenRef.current);
    }
  };

  const stop = () => {
    renderId.current++;
    player.stop();
    setStatus('idle');
    setActiveBar(null);
    releasePlayback(tokenRef.current);
  };
  tokenRef.current.stop = stop;

  if (!model) {
    return (
      <div class="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-400">
        This tune has no notation to build a backing from.
      </div>
    );
  }

  const shownKey = transposeKey(model.key, transpose);
  const toggleClass = (on) => `px-2.5 py-2.5 rounded-md text-xs font-medium border cursor-pointer ${
    on ? 'bg-brand-50 border-brand-600 text-brand-800 dark:text-brand-400' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
  }`;

  return (
    <div class="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
      <div class="flex items-center gap-2">
        <button
          onClick={status === 'idle' ? play : stop}
          disabled={!plan}
          class={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer text-white disabled:opacity-50 ${
            status === 'idle' ? 'bg-brand-600 hover:bg-brand-700' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {status === 'idle' ? <PlayIcon class="w-4 h-4" /> : <StopIcon class="w-4 h-4" />}
          {status === 'loading' ? 'Preparing…' : status === 'playing' ? 'Stop backing' : 'Play backing'}
        </button>
        <button onClick={() => setPrefs({ loop: !loop })} class={toggleClass(loop)} title="Loop the tune">Loop</button>
        <button onClick={() => setPrefs({ countIn: !prefs.countIn })} class={toggleClass(prefs.countIn)} title="One bar of clicks before the tune">Count-in</button>
      </div>
      {playError && <p class="text-xs text-red-600">{playError}</p>}

      <details class="group/chords border-t border-gray-100 pt-2">
        <summary class="cursor-pointer list-none flex items-center gap-2 text-sm select-none">
          <span class="inline-block text-gray-400 transition-transform group-open/chords:rotate-90">▸</span>
          <span class="font-medium text-gray-700">Chords</span>
          <span class="text-xs text-gray-400 truncate">
            {keyName(shownKey)} · {FAMILY_LABELS[family]} · {dirty ? 'unsaved changes' : mismatch ? 'notation changed' : source === 'saved' ? 'saved' : source === 'abc' ? 'from the notation' : 'suggested'}
          </span>
        </summary>
        <div class="mt-2 space-y-1.5">
          {mismatch && (
            <p class="text-xs text-amber-700">The notation changed since these chords were saved, so they were set aside. Saving now replaces them.</p>
          )}
          <ChordChart
            model={model}
            chords={chords}
            suggested={suggested}
            onChange={setBar}
            transpose={transpose}
            activeBar={activeBar}
          />
          <div class="flex items-center justify-end gap-3">
            {error && <span class="text-xs text-red-600 mr-auto">{error}</span>}
            {!dirty && source !== 'saved' && <span class="text-xs text-gray-400 mr-auto">Tap a bar to change its chord</span>}
            {chords !== suggested && JSON.stringify(chords) !== JSON.stringify(suggested) && (
              <button onClick={resetToSuggested} class="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Reset to suggestion</button>
            )}
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                class="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 cursor-pointer disabled:opacity-50"
              >{saving ? 'Saving…' : 'Save chords'}</button>
            )}
          </div>
        </div>
      </details>

      <BackingSettings prefs={prefs} setPrefs={setPrefs} family={family} />
    </div>
  );
}

function BackingSettings({ prefs, setPrefs, family }) {
  const strumList = STRUM_PATTERNS[family] || STRUM_PATTERNS.generic;
  const pianoList = PIANO_PATTERNS[family] || PIANO_PATTERNS.generic;
  const strumId = prefs.strumPatterns?.[family] || strumList[0].id;
  const pianoId = prefs.pianoPatterns?.[family] || pianoList[0].id;
  const canSwing = swingSupported(family);
  const autoSwing = SWING_LEVELS.find(s => s.value === swingValue('auto', family))?.label.toLowerCase();
  const on = (layer) => prefs.volumes[layer] > 0;

  // A row's Off is the layer's volume at 0; any other choice switches it
  // back on at the level it had before.
  const choose = (layer, patch) => setPrefs(p => {
    if (patch === null) {
      const lastVolumes = p.volumes[layer] > 0 ? { ...p.lastVolumes, [layer]: p.volumes[layer] } : p.lastVolumes;
      return { ...p, lastVolumes, volumes: { ...p.volumes, [layer]: 0 } };
    }
    const level = p.volumes[layer] || p.lastVolumes?.[layer] || 50;
    return { ...p, ...patch, volumes: { ...p.volumes, [layer]: level } };
  });
  const setVolume = (layer, value) => setPrefs(p => ({
    ...p,
    volumes: { ...p.volumes, [layer]: value },
    lastVolumes: value > 0 ? { ...p.lastVolumes, [layer]: value } : p.lastVolumes,
  }));
  const row = (layer, value, options, toPatch) => (
    <Segmented
      options={[OFF, ...options]}
      value={on(layer) ? value : 'off'}
      onChange={v => choose(layer, v === 'off' ? null : toPatch(v))}
    />
  );

  // One row for the chords: Off, the strum patterns, then the piano ones.
  const chordOptions = [
    ...strumList.map(p => ({ id: `strum:${p.id}`, label: p.label })),
    ...pianoList.map(p => ({ id: `piano:${p.id}`, label: p.label })),
  ];
  const chordValue = `${prefs.chordStyle}:${prefs.chordStyle === 'piano' ? pianoId : strumId}`;
  const chordPatch = (v) => {
    const [style, id] = v.split(':');
    const key = style === 'piano' ? 'pianoPatterns' : 'strumPatterns';
    return { chordStyle: style, [key]: { ...prefs[key], [family]: id } };
  };
  const chordLabel = chordOptions.find(o => o.id === chordValue)?.label;

  // Loop and count-in live on the player row, so they're left alone.
  const atDefaults = Object.keys(DEFAULT_PREFS)
    .filter(k => k !== 'loop' && k !== 'countIn')
    .every(k => JSON.stringify(prefs[k]) === JSON.stringify(DEFAULT_PREFS[k]));
  const resetToDefaults = () => setPrefs(p => ({ ...DEFAULT_PREFS, loop: p.loop, countIn: p.countIn }));

  const summary = [
    on('chords') ? `${prefs.chordStyle === 'piano' ? 'Piano' : 'Strum'}: ${chordLabel}` : 'No chords',
    on('bass') && `${BASS_STYLES.find(b => b.id === prefs.bass)?.label} bass`,
    on('drums') && 'bodhrán',
    on('drone') && 'drone',
  ].filter(Boolean).join(' · ');

  return (
    <details class="group border-t border-gray-100 pt-2">
      <summary class="cursor-pointer list-none flex items-center gap-2 text-sm select-none">
        <span class="inline-block text-gray-400 transition-transform group-open:rotate-90">▸</span>
        <span class="font-medium text-gray-700">Sound</span>
        <span class="text-xs text-gray-400 truncate">{summary}</span>
      </summary>
      <div class="mt-3 space-y-3">
        <Row label={`Chords (${FAMILY_LABELS[family].toLowerCase()})`}>
          {row('chords', chordValue, chordOptions, chordPatch)}
        </Row>
        {on('chords') && prefs.chordStyle !== 'piano' && (
          <Row label="Guitar">
            <Segmented options={GUITARS.map(id => ({ id, label: INSTRUMENTS[id].label }))} value={prefs.chordInstrument} onChange={v => setPrefs({ chordInstrument: v })} />
          </Row>
        )}
        <Row label="Bass">{row('bass', prefs.bass, BASS_STYLES, v => ({ bass: v }))}</Row>
        <Row label="Bodhrán">{row('drums', 'on', [{ id: 'on', label: 'On' }], () => ({}))}</Row>
        <Row label="Drone">{row('drone', prefs.drone, DRONES, v => ({ drone: v }))}</Row>
        {canSwing && (
          <Row label="Swing">
            <Segmented
              options={[OFF, { id: 'auto', label: `Auto${autoSwing ? ` (${autoSwing})` : ''}` }, ...SWING_LEVELS.filter(s => s.id !== 'off').map(s => ({ id: s.id, label: s.label }))]}
              value={prefs.swing}
              onChange={v => setPrefs({ swing: v })}
            />
          </Row>
        )}
        <Row label="Melody">
          {row('melody', prefs.melody, MELODY_INSTRUMENTS.map(id => ({ id, label: INSTRUMENTS[id].label })), v => ({ melody: v }))}
        </Row>
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-500">Mix</span>
          {MIX.map(([layer, label]) => (
            <label key={layer} class="flex items-center gap-3 text-sm text-gray-600">
              <span class="w-16 shrink-0">{label}</span>
              <input
                type="range" min="0" max="100" step="5"
                value={prefs.volumes[layer]}
                onInput={e => setVolume(layer, Number(e.target.value))}
                class="flex-1"
                aria-label={`${label} volume`}
              />
              <span class="w-8 text-right text-xs text-gray-400" style="font-variant-numeric: tabular-nums">{on(layer) ? prefs.volumes[layer] : 'off'}</span>
            </label>
          ))}
        </div>
        {!atDefaults && (
          <div class="flex justify-end">
            <button onClick={resetToDefaults} class="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">Reset to defaults</button>
          </div>
        )}
      </div>
    </details>
  );
}

function Row({ label, children }) {
  return (
    <div class="space-y-1">
      <div class="text-xs font-medium text-gray-500">{label}</div>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div class="flex flex-wrap gap-1">
      {options.map(o => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          class={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border ${
            value === o.id ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >{o.label}</button>
      ))}
    </div>
  );
}

function barAt(timeline, p) {
  if (!timeline.length || p < timeline[0].start) return null;
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (timeline[mid].start <= p) lo = mid; else hi = mid - 1;
  }
  return timeline[lo].bar;
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
