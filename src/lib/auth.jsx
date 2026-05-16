import { createContext } from 'preact';
import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { pb } from './pb';

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
      // Try to refresh the auth on mount
      pb.collection('users').authRefresh()
        .then(({ record }) => setUser(record))
        .catch(() => {
          pb.authStore.clear();
          setUser(null);
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

  const logout = useCallback(() => {
    pb.authStore.clear();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
