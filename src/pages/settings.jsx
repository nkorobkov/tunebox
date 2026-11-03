import { useState, useCallback, useEffect } from 'preact/hooks';
import { Shell } from '../components/layout/shell';
import { InstrumentManager } from '../components/instruments/instrument-manager';
import { useAuth } from '../lib/auth';
import { pb } from '../lib/pb';
import { getDefaultInstrument, saveDefaultInstrument } from '../hooks/use-practice';
import { getTheme, setTheme } from '../lib/theme';
import { OfflineBanner } from '../components/common/offline-banner';
import { useConnectivity } from '../lib/connectivity';
import { FeedbackFooter } from '../components/feedback/feedback-footer';
import { Button } from '../components/common/button';

// How this account signs in. Accounts with a linked Google login are Google-only (the
// server refuses codes, passwords and reset emails for them); code accounts may add a
// backup password through the "set password" email (see pages/reset-password.jsx).
function SignInMethod({ user }) {
  const { sendPasswordLink } = useAuth();
  const [google, setGoogle] = useState(null); // null while checking
  const [link, setLink] = useState('idle');   // idle | sending | sent | failed

  useEffect(() => {
    pb.collection('_externalAuths')
      .getList(1, 10, { filter: `recordRef = "${user.id}"`, requestKey: 'settings-external-auths' })
      .then((res) => setGoogle(res.items.some((a) => a.provider === 'google')))
      .catch(() => setGoogle(null));
  }, [user.id]);

  if (google === null) return null;
  if (google) return <p>You sign in with Google.</p>;

  const send = async () => {
    setLink('sending');
    try { await sendPasswordLink(user.email); setLink('sent'); } catch { setLink('failed'); }
  };
  return (
    <div class="space-y-2">
      <p>You sign in with a code sent to your email. A password is optional.</p>
      {link === 'sent'
        ? <p class="text-gray-700">Check your email for a link to set your password.</p>
        : (
          <Button variant="secondary" onClick={send} disabled={link === 'sending'}>
            {link === 'sending' ? 'Sending…' : 'Email me a link to set a password'}
          </Button>
        )}
      {link === 'failed' && <p class="text-red-600">Couldn’t send the email. Try again.</p>}
    </div>
  );
}

function NameField({ user }) {
  const [name, setName] = useState(user?.name || '');
  const [state, setState] = useState('idle'); // idle | saving | saved | failed
  const dirty = name.trim() !== (user?.name || '');

  const save = async (e) => {
    e.preventDefault();
    setState('saving');
    try {
      // The SDK refreshes the auth store with the updated record
      await pb.collection('users').update(user.id, { name: name.trim() });
      setState('saved');
    } catch {
      setState('failed');
    }
  };

  return (
    <form onSubmit={save} class="flex flex-wrap items-center gap-2">
      <label for="settings-name">Name:</label>
      <input
        id="settings-name" type="text" autocomplete="name" value={name} placeholder="Your name"
        onInput={(e) => { setName(e.target.value); setState('idle'); }}
        class="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {dirty && <Button type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save'}</Button>}
      {state === 'saved' && !dirty && <span class="text-gray-400">Saved</span>}
      {state === 'failed' && <span class="text-red-600">Couldn’t save</span>}
    </form>
  );
}

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

      <div class="space-y-8">
        {/* Account */}
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <h2 class="text-base font-semibold text-gray-900 mb-3">Account</h2>
          <div class="text-sm text-gray-500 space-y-3">
            <p>Email: {user?.email}</p>
            <NameField user={user} />
            <SignInMethod user={user} />
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

        <FeedbackFooter />
      </div>
    </Shell>
  );
}
