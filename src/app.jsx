import Router from 'preact-router';
import { AuthProvider, useAuth } from './lib/auth';
import { LoginPage } from './pages/login';
import { LibraryPage } from './pages/library';
import { TunePage } from './pages/tune';
import { AddTunePage } from './pages/add-tune';
import { PracticePage } from './pages/practice';
import { SettingsPage } from './pages/settings';

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div class="min-h-screen bg-gray-50 flex items-center justify-center">
        <p class="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Router>
      <LibraryPage path="/" />
      <TunePage path="/tune/:id" />
      <AddTunePage path="/add" />
      <PracticePage path="/practice" />
      <SettingsPage path="/settings" />
    </Router>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
