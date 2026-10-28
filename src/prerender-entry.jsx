// Entry for scripts/prerender.mjs (Node-only, never bundled into the app).
// Renders the landing page and the sheet music scanner as anonymous visitors — and
// crawlers — see them.
import { render } from 'preact-render-to-string';
import { AuthProvider } from './lib/auth';
import { LandingPage } from './pages/landing';
import { PublicPage as ScannerPage, FAQ as SCANNER_FAQ } from './pages/play-sheet-music';

export { SCANNER_FAQ };

export function renderLandingPage() {
  return render(
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  );
}

export function renderScannerPage() {
  return render(
    <AuthProvider>
      <ScannerPage />
    </AuthProvider>
  );
}
