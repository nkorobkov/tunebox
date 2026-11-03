import { useState, useRef, useEffect } from 'preact/hooks';
import { Dialog } from '../common/dialog';
import { Button } from '../common/button';
import { GoogleButton } from './google-button';
import { Turnstile } from '../parse/turnstile';
import { useAuth, authErrorCode } from '../../lib/auth';
import { TURNSTILE_SITE_KEY } from '../../lib/omr-api';

// Sign in or sign up. Google, or an emailed one-time code (a new address gets an account);
// a password works too for code accounts that set one in settings. Accounts with a linked
// Google login are Google-only: the server answers `use_google` and we say so.
// On success the auth store changes and the signed-out page (with this dialog) unmounts;
// a tune parked with parkPendingTune is then claimed by PendingTuneImport in app.jsx.
//
// views: email (Google + email for a code) → code; password; google (address is Google-only)

const field = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
const link = 'text-sm text-blue-600 hover:underline cursor-pointer';

const MESSAGES = {
  turnstile_failed: 'The bot check failed. Try again.',
  rate_limited: 'Too many tries. Wait a few minutes.',
  offline: 'You’re offline.',
};

export function SignInDialog({ onClose, title = 'Sign in to TuneBox', intro }) {
  const { loginWithGoogle, requestCode, verifyCode, loginWithPassword } = useAuth();
  const codesOn = !!TURNSTILE_SITE_KEY;
  const [view, setView] = useState(codesOn ? 'email' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpId, setOtpId] = useState(null);
  const [token, setToken] = useState(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const codeRef = useRef(null);

  useEffect(() => { if (view === 'code') codeRef.current?.focus(); }, [view]);

  const go = (next) => { setError(''); setView(next); };

  const google = async () => {
    setError(''); setBusy(true);
    try { await loginWithGoogle(); } catch { setBusy(false); setError('Google sign-in didn’t start. Try again.'); }
  };

  const sendCode = async (e) => {
    e.preventDefault();
    if (!token) return;
    setError(''); setBusy(true);
    try {
      setOtpId(await requestCode(email, token));
      setToken(null); // spent; the widget makes a new one when the email view returns
      setCode('');
      go('code');
    } catch (err) {
      const why = authErrorCode(err);
      if (why === 'use_google') go('google');
      else setError(MESSAGES[why] || 'Couldn’t send the code. Try again.');
    } finally {
      setBusy(false);
      setTurnstileReset((n) => n + 1); // tokens are single use
    }
  };

  const submitCode = async (value = code) => {
    if (busy || value.replace(/\D/g, '').length < 6) return;
    setError(''); setBusy(true);
    try {
      await verifyCode(otpId, value);
    } catch (err) {
      setBusy(false);
      const why = authErrorCode(err);
      setError(why === 'rate_limited' ? 'Too many tries. Send a new code.'
        : why === 'invalid' ? 'That code didn’t work. Check it or send a new one.'
          : MESSAGES[why] || 'Couldn’t sign in. Try again.');
    }
  };

  // No maxlength on the input: it would cut a pasted "123 456" before the digits are kept
  const onCodeInput = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    if (value.length === 6) submitCode(value); // typed, pasted or autofilled
  };

  const signInWithPassword = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await loginWithPassword(email, password);
    } catch (err) {
      setBusy(false);
      const why = authErrorCode(err);
      if (why === 'use_google') go('google');
      else setError(why === 'invalid' ? 'Wrong email or password.' : MESSAGES[why] || 'Couldn’t sign in. Try again.');
    }
  };

  const googleButton = (
    <GoogleButton onClick={google} disabled={busy} class="w-full px-4 py-2.5 border border-gray-300 bg-white text-gray-800 hover:bg-gray-50">
      Continue with Google
    </GoogleButton>
  );
  const emailInput = (
    <input
      type="email" name="email" autocomplete="email" required
      aria-label="Email" placeholder="you@example.com"
      value={email} onInput={(e) => setEmail(e.target.value)} class={field}
    />
  );
  const errorLine = error && <p class="m-0 text-sm text-red-600" role="alert">{error}</p>;

  return (
    <Dialog title={view === 'google' ? 'Use Google to sign in' : title} onClose={onClose} maxWidth="max-w-sm">
      {view === 'email' && (
        <>
          {intro && <p class="m-0 text-sm text-gray-600">{intro}</p>}
          {googleButton}
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span class="flex-1 border-t border-gray-200" />or<span class="flex-1 border-t border-gray-200" />
          </div>
          <form onSubmit={sendCode} class="space-y-3">
            {emailInput}
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY} action="sign-in" appearance="interaction-only"
              onToken={setToken} resetKey={turnstileReset}
              onError={() => setError('The bot check didn’t load. Allow it in your content blocker, or use Google.')}
            />
            {errorLine}
            <Button type="submit" size="md" class="w-full" disabled={busy || !token}>
              {busy ? 'Sending…' : 'Email me a code'}
            </Button>
          </form>
          <p class="m-0 text-xs text-gray-500">New here? The code creates your account.</p>
          <button type="button" class={link} onClick={() => go('password')}>Use a password instead</button>
        </>
      )}

      {view === 'code' && (
        <form onSubmit={(e) => { e.preventDefault(); submitCode(); }} class="space-y-3">
          <p class="m-0 text-sm text-gray-600">
            Enter the code sent to <span class="font-medium text-gray-900">{email.trim()}</span>.
          </p>
          <input
            ref={codeRef}
            type="text" name="code" inputmode="numeric" autocomplete="one-time-code"
            aria-label="Code" placeholder="123456"
            value={code} onInput={onCodeInput}
            class={`${field} text-center text-xl tracking-[0.4em] font-mono`}
          />
          {errorLine}
          <Button type="submit" size="md" class="w-full" disabled={busy || code.length < 6}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p class="m-0 text-xs text-gray-500">No email? Check spam, or send a new code.</p>
          <div class="flex justify-between">
            <button type="button" class={link} onClick={() => go('email')}>Send a new code</button>
            <button type="button" class={link} onClick={() => { setEmail(''); go('email'); }}>Use a different email</button>
          </div>
        </form>
      )}

      {view === 'password' && (
        <>
          <form onSubmit={signInWithPassword} class="space-y-3">
            {emailInput}
            <input
              type="password" name="password" autocomplete="current-password" required
              aria-label="Password" placeholder="Password"
              value={password} onInput={(e) => setPassword(e.target.value)} class={field}
            />
            {errorLine}
            <Button type="submit" size="md" class="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          {codesOn
            ? <button type="button" class={link} onClick={() => go('email')}>Email me a code instead</button>
            : googleButton}
        </>
      )}

      {view === 'google' && (
        <>
          <p class="m-0 text-sm text-gray-600">
            <span class="font-medium text-gray-900">{email.trim()}</span> signs in with Google.
          </p>
          {googleButton}
          {errorLine}
          <button type="button" class={link} onClick={() => { setEmail(''); go(codesOn ? 'email' : 'password'); }}>
            Use a different email
          </button>
        </>
      )}
    </Dialog>
  );
}
