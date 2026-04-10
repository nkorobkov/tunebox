import { useState, useCallback } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { InstrumentManager } from '../components/instruments/instrument-manager';
import { useAuth } from '../lib/auth';
import { pb } from '../lib/pb';

export function SettingsPage() {
  const { user } = useAuth();
  const [instruments, setInstruments] = useState(user?.instruments || []);
  const [saving, setSaving] = useState(false);

  const handleUpdateInstruments = useCallback(async (updated) => {
    setSaving(true);
    try {
      await pb.collection('users').update(user.id, { instruments: updated });
      setInstruments(updated);
    } catch (err) {
      console.error('Failed to update instruments:', err);
    } finally {
      setSaving(false);
    }
  }, [user]);

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

        {/* Instruments */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h2 class="text-base font-semibold text-gray-900 mb-1">My Instruments</h2>
          <p class="text-xs text-gray-400 mb-3">
            Add instruments you play. These will appear as options when tracking progress on tunes.
          </p>
          <InstrumentManager
            instruments={instruments}
            onUpdate={handleUpdateInstruments}
          />
          {saving && <p class="text-xs text-gray-400 mt-2">Saving...</p>}
        </div>
      </div>
    </Shell>
  );
}
