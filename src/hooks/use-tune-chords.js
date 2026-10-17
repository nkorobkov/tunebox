import { useState, useMemo, useCallback } from 'preact/hooks';
import { pb } from '../lib/pb';
import { updateTuneInCache } from '../lib/tune-cache';
import { parseBars } from '../lib/backing/abc-bars';
import { suggestChords, chordsFromAbc } from '../lib/backing/chords';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A tune's backing chords: one value per written bar (see lib/backing/chords.js).
 * Starts from the chords saved on the record (`user_tunes.backing.chords`),
 * else the chords written in the ABC, else a guess from the melody. Saved
 * chords are tied to the bar count they were made for; if the notation has
 * since changed shape they are set aside (`mismatch`) rather than misapplied.
 */
export function useTuneChords(tune, abc) {
  const model = useMemo(() => parseBars(abc), [abc]);
  const fromAbc = useMemo(() => (model ? chordsFromAbc(model) : null), [model]);
  const suggested = useMemo(() => (model ? fromAbc || suggestChords(model) : null), [model, fromAbc]);

  const stored = tune.backing?.chords;
  const mismatch = !!(stored && model && tune.backing.bars !== model.bars.length);
  const usable = stored && model && !mismatch ? stored : null;

  const [saved, setSaved] = useState(usable);
  const [chords, setChords] = useState(usable || suggested);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const baseline = saved || suggested;
  const dirty = !!chords && !same(chords, baseline);

  const setBar = useCallback((index, value) => {
    setChords(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const resetToSuggested = useCallback(() => setChords(suggested), [suggested]);

  const save = useCallback(async () => {
    if (!model || !chords) return;
    setSaving(true);
    setError(null);
    // chords identical to the guess are stored as "none", so later
    // improvements to the guesser still reach this tune
    const backing = { ...(tune.backing || {}), chords: same(chords, suggested) ? null : chords, bars: model.bars.length };
    try {
      const updated = await pb.collection('user_tunes').update(tune.id, { backing });
      if (!('backing' in updated)) {
        throw new Error('The server is missing the user_tunes.backing field — apply the latest PocketBase migration.');
      }
      // the practice queue keeps this tune object; keep it current for the rest of the session
      tune.backing = updated.backing;
      const userId = pb.authStore.record?.id;
      if (userId) updateTuneInCache(userId, tune.id, { backing: updated.backing });
      setSaved(updated.backing?.chords || null);
    } catch (err) {
      setError(err?.message || 'Could not save chords');
    } finally {
      setSaving(false);
    }
  }, [model, chords, suggested, tune]);

  const source = saved ? 'saved' : fromAbc ? 'abc' : 'guess';

  return { model, chords, suggested, setBar, resetToSuggested, save, saving, error, dirty, source, mismatch };
}
