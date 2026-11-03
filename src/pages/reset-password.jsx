import { useState, useMemo } from 'preact/hooks';
import { route } from 'preact-router';
import { pb } from '../lib/pb';
import { useAuth, authErrorCode } from '../lib/auth';
import { Button } from '../components/common/button';

// /auth/reset/:token — where the "Set your TuneBox password" email links (the users
// collection's reset template). That email is how a code account sets a backup password:
// PB only changes a password given the old one. Works signed in or out; after saving we
// sign in with the new password, since changing it ends the account's other sessions.

function emailFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.email || '';
  } catch {
    return '';
  }
}

export function ResetPasswordPage({ token = '' }) {
  const { loginWithPassword } = useAuth();
  const email = useMemo(() => emailFromToken(token), [token]);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setError(''); setBusy(true);
    try {
      await pb.collection('users').confirmPasswordReset(token, password, password);
    } catch (err) {
      setBusy(false);
      setError(authErrorCode(err) === 'invalid'
        ? 'This link has expired or was already used. Ask for a new one in settings.'
        : 'Couldn’t save the password. Try again.');
      return;
    }
    try {
      if (email) await loginWithPassword(email, password);
    } catch { /* saved anyway; they can sign in from the landing page */ }
    route('/', true);
  };

  return (
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={save} class="bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-sm p-5 space-y-4">
        <img src="/tunebook.svg" alt="TuneBox" class="h-7" />
        <h1 class="text-base font-semibold text-gray-900 m-0">Set a password</h1>
        {email && <p class="m-0 text-sm text-gray-600">For <span class="font-medium text-gray-900">{email}</span>. You can still sign in with an emailed code.</p>}
        {/* Lets password managers save the pair */}
        <input type="email" name="email" autocomplete="username" value={email} readOnly hidden />
        <input
          type="password" name="password" autocomplete="new-password" required minLength={8}
          aria-label="New password" placeholder="New password (8+ characters)"
          value={password} onInput={(e) => setPassword(e.target.value)}
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {error && <p class="m-0 text-sm text-red-600" role="alert">{error}</p>}
        <Button type="submit" size="md" class="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button>
      </form>
    </div>
  );
}
