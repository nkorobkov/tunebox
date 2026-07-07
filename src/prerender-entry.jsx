// Entry for scripts/prerender.mjs (Node-only, never bundled into the app).
// Renders the landing page as anonymous visitors — and crawlers — see it.
import { render } from 'preact-render-to-string';
import { AuthProvider } from './lib/auth';
import { LandingPage } from './pages/landing';

export function renderLandingPage() {
  return render(
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  );
}
