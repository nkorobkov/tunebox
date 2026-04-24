import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import { AbcPlayer } from '../tune/abc-player';
import { useMetronome } from '../../hooks/use-metronome';
import { buildAbcString, getMeter, hasChordAnnotations, chordsOnlyAbc } from '../../lib/abc-utils';
import { generateChords } from '../../lib/chord-generator';

const MODE_LABELS = {
  'metronome': 'Metronome',
  'chords': 'Chords',
};

const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'];

export function PracticeTools({ tune, fullAbc, tempo, transpose, onTempoChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [accompMode, setAccompMode] = useState('metronome');
  const [generatedAbc, setGeneratedAbc] = useState(null);

  useEffect(() => {
    setIsPlaying(false);
    setAccompMode('metronome');
    setGeneratedAbc(null);
  }, [tune.id]);

  const ts = getMeter(tune.type);
  const metronome = useMetronome(tempo, ts);

  const abcWithChords = useMemo(() => {
    if (generatedAbc) return generatedAbc;
    if (fullAbc && hasChordAnnotations(fullAbc)) return fullAbc;
    return null;
  }, [fullAbc, generatedAbc]);

  const chordsAbc = useMemo(() => {
    return abcWithChords ? chordsOnlyAbc(abcWithChords) : null;
  }, [abcWithChords]);

  const playClicks = isPlaying && accompMode === 'metronome';
  const playChords = isPlaying && accompMode === 'chords' && !!chordsAbc;

  useEffect(() => {
    if (playClicks) metronome.start();
    else metronome.stop();
    return () => metronome.stop();
  }, [playClicks, metronome.start, metronome.stop]);

  const handleToggle = () => setIsPlaying(p => !p);

  const ensureChords = () => {
    if (abcWithChords || !tune.abc) return;
    const raw = generateChords(tune.abc, tune.setting_key, ts);
    setGeneratedAbc(buildAbcString(tune.title, tune.type, tune.setting_key, raw));
  };

  const cycleMode = () => {
    const next = accompMode === 'metronome' ? 'chords' : 'metronome';
    if (next === 'chords') ensureChords();
    setAccompMode(next);
  };

  const handleBpmChange = (newBpm) => {
    metronome.updateBpm(newBpm);
    if (onTempoChange) onTempoChange(newBpm);
  };

  const handleChordController = useCallback((controller) => {
    if (controller) {
      try { controller.play(); } catch {}
    }
  }, []);

  return (
    <div class="space-y-2">
      {fullAbc && <AbcPlayer abc={fullAbc} defaultTempo={tempo} transpose={transpose} />}

      {playChords && (
        <div class="hidden">
          <AbcPlayer
            abc={chordsAbc}
            defaultTempo={tempo}
            transpose={transpose}
            onController={handleChordController}
          />
        </div>
      )}

      <div class="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div class="flex items-center gap-2">
          <button
            onClick={handleToggle}
            class={`px-4 py-2 rounded-md text-sm font-medium cursor-pointer touch-manipulation ${
              isPlaying
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-800 text-white hover:bg-gray-900'
            }`}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>

          {tune.abc && (
            <button
              onClick={cycleMode}
              class="px-3 py-2 rounded-md text-sm font-medium cursor-pointer touch-manipulation bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-300"
            >
              {MODE_LABELS[accompMode]}
            </button>
          )}

          <TimeSignaturePicker value={metronome.timeSignature} onChange={metronome.updateTimeSignature} />
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={() => handleBpmChange(Math.max(20, metronome.bpm - 5))}
            class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-gray-100 cursor-pointer shrink-0"
          >-</button>
          <input
            type="range"
            min={20}
            max={280}
            value={metronome.bpm}
            onInput={e => handleBpmChange(Number(e.target.value))}
            class="flex-1 min-w-0 lg:w-32"
          />
          <button
            onClick={() => handleBpmChange(Math.min(280, metronome.bpm + 5))}
            class="w-8 h-8 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-gray-100 cursor-pointer shrink-0"
          >+</button>
          <span class="text-sm font-mono text-gray-700 w-14 text-center shrink-0">{metronome.bpm} bpm</span>
        </div>
      </div>
    </div>
  );
}

function TimeSignaturePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div class="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        class="px-3 py-2 rounded-md text-sm font-mono font-medium border border-gray-300 bg-white hover:bg-gray-100 cursor-pointer touch-manipulation"
      >
        {value}
      </button>
      {open && (
        <div class="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
          {TIME_SIGNATURES.map(ts => (
            <button
              key={ts}
              onClick={() => { onChange(ts); setOpen(false); }}
              class={`block w-full px-4 py-2 text-sm font-mono text-left cursor-pointer hover:bg-gray-100 ${
                ts === value ? 'bg-gray-100 font-bold' : ''
              }`}
            >
              {ts}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
