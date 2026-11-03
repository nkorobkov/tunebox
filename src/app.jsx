import { useEffect } from 'preact/hooks';
import Router, { route } from 'preact-router';
import { AuthProvider, useAuth } from './lib/auth';
import { ConnectivityProvider, useConnectivity } from './lib/connectivity';
import { flushQueue } from './lib/practice-queue';
import { initServiceWorkerUpdates } from './lib/sw-update';
import { claimPendingTune } from './lib/pending-tune';
import { LandingPage } from './pages/landing';
import { LibraryPage } from './pages/library';
import { TunePage } from './pages/tune';
import { SetPage } from './pages/set';
import { AddTunePage } from './pages/add-tune';
import { PracticePage } from './pages/practice';
import { SettingsPage } from './pages/settings';
import { InstallPage } from './pages/install';
import { UserPage } from './pages/user';
import { PlaySheetMusicPage } from './pages/play-sheet-music';
import { ResetPasswordPage } from './pages/reset-password';
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

// Adds the tune a signed-out visitor picked on a collection page (or scanned) before
// signing in. Mounted when the signed-in router first renders, so it runs after any
// kind of sign-in: the Google redirect, or a code/password in the sign-in dialog.
function PendingTuneImport() {
  useEffect(() => {
    claimPendingTune()
      .then((record) => { if (record) route(`/tune/${record.id}`); })
      .catch((err) => console.error('Failed to add tune from collection page:', err));
  }, []);
  return null;
}

// The scanner's old address (/parse-abc); dist/parse-abc/index.html redirects too, for
// visits that don't go through the service worker.
function OldScannerAddress() {
  useEffect(() => { route('/play-sheet-music/', true); }, []);
  return null;
}

// Unknown address while signed in. Usually a page newer than the cached app: right after
// a deploy, the service worker may still serve the old build, and the new one takes over
// and reloads the page moments later. Keeping the URL (no redirect) means that reload
// lands on the right page. Without this route the signed-in router rendered nothing.
function NotFound() {
  return (
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div class="text-center space-y-3">
        <p class="m-0 text-gray-700">This page didn’t load. Try reloading.</p>
        <div class="flex gap-4 justify-center text-sm">
          <button type="button" onClick={() => window.location.reload()} class="text-blue-600 hover:underline cursor-pointer">Reload</button>
          <a href="/" class="text-blue-600 hover:underline">Go to your tunes</a>
        </div>
      </div>
    </div>
  );
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
    // Pages that work signed out; every other path shows the landing page
    return (
      <Router>
        <PlaySheetMusicPage path="/play-sheet-music" />
        <OldScannerAddress path="/parse-abc" />
        <ResetPasswordPage path="/auth/reset/:token" />
        <LandingPage default />
      </Router>
    );
  }

  return (
    <>
      <FlushOnReconnect />
      <ServiceWorkerBootstrap />
      <PendingTuneImport />
      <Router>
        <LibraryPage path="/" />
        <TunePage path="/tune/:id" />
        <SetPage path="/set/:name" />
        <AddTunePage path="/add" />
        <PracticePage path="/practice" />
        <SettingsPage path="/settings" />
        <InstallPage path="/install" />
        <UserPage path="/user" />
        <PlaySheetMusicPage path="/play-sheet-music" />
        <OldScannerAddress path="/parse-abc" />
        <ResetPasswordPage path="/auth/reset/:token" />
        <NotFound default />
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
