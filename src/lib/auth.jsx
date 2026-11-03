import { createContext } from 'preact';
import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { pb } from './pb';
import { clearTuneCache } from './tune-cache';

const AuthContext = createContext(null);

const OAUTH_STORAGE_KEY = 'pb_oauth_pending';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.record);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync state when auth store changes
    const unsub = pb.authStore.onChange((token, record) => {
      setUser(record);
    });

    // Check if we're returning from an OAuth redirect
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const stored = localStorage.getItem(OAUTH_STORAGE_KEY);

    if (code && state && stored) {
      const { provider, codeVerifier, state: savedState } = JSON.parse(stored);
      localStorage.removeItem(OAUTH_STORAGE_KEY);

      if (state === savedState) {
        const redirectUrl = window.location.origin + '/';
        pb.collection('users').authWithOAuth2Code(provider, code, codeVerifier, redirectUrl)
          .then(({ record }) => setUser(record))
          .catch((err) => console.error('OAuth code exchange failed:', err))
          .finally(() => {
            // Clean URL params
            window.history.replaceState({}, '', window.location.pathname);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    } else if (pb.authStore.isValid) {
      // Token is locally valid (JWT exp not reached). Try to refresh it, but
      // only clear the session on a real auth rejection — network failures
      // (offline, PB down) must keep the existing session so the user isn't
      // bounced to login when they refresh the page offline.
      pb.collection('users').authRefresh()
        .then(({ record }) => setUser(record))
        .catch((err) => {
          if (err?.status === 401 || err?.status === 403) {
            pb.authStore.clear();
            setUser(null);
          }
          // Otherwise: keep pb.authStore.record (still locally valid).
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return unsub;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const methods = await pb.collection('users').listAuthMethods();
    const google = methods.oauth2.providers.find(p => p.name === 'google');
    if (!google) throw new Error('Google OAuth provider not configured');

    const redirectUrl = window.location.origin + '/';

    // Store verifier for when we return from the redirect
    localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify({
      provider: google.name,
      codeVerifier: google.codeVerifier,
      state: google.state,
    }));

    // Redirect to Google OAuth (replace PB's redirect_uri with our app URL)
    const authUrl = google.authURL + encodeURIComponent(redirectUrl);
    window.location.href = authUrl;
  }, []);

  // Email sign-in: a one-time code is the main method (requesting one for a new address
  // creates the account, server-side in pb_hooks/auth_rules.pb.js), a password is an
  // optional backup. Accounts with a linked Google login reject both with `use_google`
  // (see authErrorCode). Code requests need a Turnstile token.
  const requestCode = useCallback(async (email, turnstileToken) => {
    const { otpId } = await pb.collection('users').requestOTP(normalizeEmail(email), {
      body: { email: normalizeEmail(email), turnstileToken },
    });
    return otpId;
  }, []);

  const verifyCode = useCallback(
    (otpId, code) => pb.collection('users').authWithOTP(otpId, code.replace(/\D/g, '')),
    [],
  );

  const loginWithPassword = useCallback(
    (email, password) => pb.collection('users').authWithPassword(normalizeEmail(email), password),
    [],
  );

  // "Set a password": PB only changes a password given the old one, which code accounts
  // never had, so it goes through the reset email (/auth/reset/:token).
  const sendPasswordLink = useCallback(
    (email) => pb.collection('users').requestPasswordReset(normalizeEmail(email)),
    [],
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
    clearTuneCache();
    // Practice queue is intentionally NOT cleared — entries are scoped by
    // userId, so the same user can sign back in and finish flushing them.
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, loginWithGoogle, requestCode, verifyCode, loginWithPassword, sendPasswordLink, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Code accounts are created with lowercase addresses; PB matches emails case-sensitively.
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

/**
 * The reason an auth request failed, for the sign-in UI: 'use_google' (Google-only
 * account), 'turnstile_failed', 'rate_limited', 'invalid' (wrong code/password or bad
 * input), 'offline' or 'unknown'.
 */
export function authErrorCode(err) {
  const data = err?.response?.data || {};
  if (data.email?.code === 'use_google') return 'use_google';
  if (data.turnstileToken?.code === 'turnstile_failed') return 'turnstile_failed';
  if (err?.status === 429) return 'rate_limited';
  if (err?.status === 0) return 'offline';
  if (err?.status === 400) return 'invalid';
  return 'unknown';
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
