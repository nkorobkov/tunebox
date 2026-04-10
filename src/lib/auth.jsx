import { createContext } from 'preact';
import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { pb } from './pb';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.record);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync state when auth store changes
    const unsub = pb.authStore.onChange((token, record) => {
      setUser(record);
    });

    // Try to refresh the auth on mount
    if (pb.authStore.isValid) {
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
    const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' });
    return authData;
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
