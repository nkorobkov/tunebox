import { useEffect } from 'preact/hooks';
import Router from 'preact-router';
import { AuthProvider, useAuth } from './lib/auth';
import { ConnectivityProvider, useConnectivity } from './lib/connectivity';
import { flushQueue } from './lib/practice-queue';
import { initServiceWorkerUpdates } from './lib/sw-update';
import { LandingPage } from './pages/landing';
import { LibraryPage } from './pages/library';
import { TunePage } from './pages/tune';
import { AddTunePage } from './pages/add-tune';
import { PracticePage } from './pages/practice';
import { SettingsPage } from './pages/settings';
import { InstallPage } from './pages/install';
import { UserPage } from './pages/user';
import { LoadingIndicator } from './components/loading-indicator';

function FlushOnReconnect() {
  const { subscribeOnline, isOnline } = useConnectivity();
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    if (isOnline) flushQueue(userId);
    return subscribeOnline(() => flushQueue(userId));
  }, [isOnline, subscribeOnline, userId]);
  return null;
}

function ServiceWorkerBootstrap() {
  useEffect(() => { initServiceWorkerUpdates(); }, []);
  return null;
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div class="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingIndicator />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <>
      <FlushOnReconnect />
      <ServiceWorkerBootstrap />
      <Router>
        <LibraryPage path="/" />
        <TunePage path="/tune/:id" />
        <AddTunePage path="/add" />
        <PracticePage path="/practice" />
        <SettingsPage path="/settings" />
        <InstallPage path="/install" />
        <UserPage path="/user" />
      </Router>
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ConnectivityProvider>
        <AppRouter />
      </ConnectivityProvider>
    </AuthProvider>
  );
}
