import { useState, useCallback } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { InstrumentManager } from '../components/instruments/instrument-manager';
import { useAuth } from '../lib/auth';
import { pb } from '../lib/pb';
import { getDefaultInstrument, saveDefaultInstrument } from '../hooks/use-practice';
import { getTheme, setTheme } from '../lib/theme';
import { OfflineBanner } from '../components/common/offline-banner';
import { useConnectivity } from '../lib/connectivity';

export function SettingsPage() {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const [instruments, setInstruments] = useState(user?.instruments || []);
  const [saving, setSaving] = useState(false);
  const [theme, setThemeState] = useState(getTheme);
  const [defaultInst, setDefaultInst] = useState(() => {
    const saved = getDefaultInstrument();
    const list = user?.instruments || [];
    return list.includes(saved) ? saved : (list[0] || '');
  });

  const handleUpdateInstruments = useCallback(async (updated, removedInstrument) => {
    setSaving(true);
    try {
      await pb.collection('users').update(user.id, { instruments: updated });
      setInstruments(updated);
      // If default instrument was removed, reset to first
      if (!updated.includes(defaultInst)) {
        const newDefault = updated[0] || '';
        setDefaultInst(newDefault);
        saveDefaultInstrument(newDefault);
      }
      // Strip progress for the removed instrument from all tunes
      if (removedInstrument) {
        const userId = pb.authStore.record.id;
        const result = await pb.collection('user_tunes').getList(1, 500, {
          filter: `user = "${userId}"`,
        });
        const updates = result.items
          .filter(tune => tune.instruments?.[removedInstrument])
          .map(tune => {
            const { [removedInstrument]: _, ...rest } = tune.instruments;
            return pb.collection('user_tunes').update(tune.id, { instruments: rest });
          });
        const results = await Promise.allSettled(updates);
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) {
          console.error(`Failed to clean up ${failed.length} tune(s):`, failed);
        }
      }
    } catch (err) {
      console.error('Failed to update instruments:', err);
    } finally {
      setSaving(false);
    }
  }, [user, defaultInst]);

  const handleSetTheme = (value) => {
    setThemeState(value);
    setTheme(value);
  };

  const handleSetDefault = (inst) => {
    const val = inst || instruments[0] || '';
    setDefaultInst(val);
    saveDefaultInstrument(val);
  };

  return (
    <Shell>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div class="max-w-xl space-y-8">
        {/* Account */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h2 class="text-base font-semibold text-gray-900 mb-3">Account</h2>
          <div class="text-sm text-gray-500 space-y-1">
            <p>Email: {user?.email}</p>
            <p>Name: {user?.name || '—'}</p>
          </div>
        </div>

        {/* Appearance */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h2 class="text-base font-semibold text-gray-900 mb-1">Appearance</h2>
          <p class="text-xs text-gray-400 mb-3">
            Sheet music always renders on a light background.
          </p>
          <div class="flex gap-2">
            {['light', 'dark'].map((value) => (
              <button
                key={value}
                onClick={() => handleSetTheme(value)}
                class={`px-3 py-1.5 rounded-full text-sm border cursor-pointer capitalize ${
                  theme === value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* Instruments */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h2 class="text-base font-semibold text-gray-900 mb-1">My instruments</h2>
          <p class="text-xs text-gray-400 mb-3">
            Add instruments you play. These will appear as options when tracking progress on tunes.
          </p>
          <OfflineBanner message="Instrument changes are unavailable offline." />
          <InstrumentManager
            instruments={instruments}
            onUpdate={handleUpdateInstruments}
            defaultInstrument={defaultInst}
            onSetDefault={handleSetDefault}
            disabled={isOffline}
          />
          {saving && <p class="text-xs text-gray-400 mt-2">Saving...</p>}
        </div>
      </div>
    </Shell>
  );
}
