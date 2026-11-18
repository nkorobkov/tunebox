import { useState, useMemo } from 'preact/hooks';
import { ChordChart } from './chord-chart';
import { arrange } from '../../lib/backing/arrange';
import { loadPrefs, savePrefs, DEFAULT_PREFS, INSTRUMENTS, GUITARS, MELODY_INSTRUMENTS } from '../../lib/backing/prefs';
import {
  rhythmFamily, FAMILY_LABELS, STRUM_PATTERNS, PIANO_PATTERNS, SWING_LEVELS, swingSupported, swingValue,
} from '../../lib/backing/patterns';
import { keyName, transposeKey } from '../../lib/backing/chords';
import { usePlanPlayer } from '../../hooks/use-plan-player';

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
 * Generated backing for one tune: the player state, without UI. Owned by the
 * practice card (alongside `chordState` from useTuneChords, which the sheet
 * music shares); the play button lives in PracticeSound and the settings in
 * BackingOptions. `available` is false when the tune has no notation;
 * nothing is arranged unless `enabled`.
 */
export function useBacking({ tune, abc, tempo, transpose, chordState, enabled = true }) {
  const { model, chords } = chordState;
  const [savedPrefs, setPrefs] = usePrefs();
  // The backing always loops and counts in (no switches for them any more,
  // so earlier saved "off" values are ignored).
  const prefs = { ...savedPrefs, loop: true, countIn: true };
  const family = model ? rhythmFamily(model.meter, tune.type) : 'generic';

  // loop doesn't change the arrangement — keep it out of the plan's inputs
  const { loop, ...arrangePrefs } = prefs;
  const prefsKey = JSON.stringify(arrangePrefs);
  const plan = useMemo(() => {
    // arranging is real work (it runs abcjs's audio setup), so skip it while
    // the metronome is the chosen sound
    if (!enabled || !abc || !model || !chords || !tempo) return null;
    try {
      return arrange({ abc, model, chordValues: chords, tempo, transpose, prefs: arrangePrefs, tuneType: tune.type });
    } catch (err) {
      console.error('Backing arrangement failed:', err);
      return null;
    }
  }, [enabled, abc, model, chords, tempo, transpose, prefsKey, tune.type]);

  const playback = usePlanPlayer(plan, { loop: true });
  return { available: !!model, ready: !!plan, ...playback, prefs, setPrefs, family, chordState, transpose };
}

/** The generated backing's settings: the sound (open by default), then the chord chart. */
export function BackingOptions({ backing }) {
  const { prefs, setPrefs, family, activeBar, chordState, transpose } = backing;
  const { model, chords, suggested, setBar, resetToSuggested, save, saving, error, dirty, source, mismatch } = chordState;
  if (!model) return null;

  const shownKey = transposeKey(model.key, transpose);
  return (
    <div class="space-y-3">
      <BackingSettings prefs={prefs} setPrefs={setPrefs} family={family} />

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

  // Loop and count-in are always on and have no switches; leave them alone.
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
    <details open class="group">
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
