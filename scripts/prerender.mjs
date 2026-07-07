// Post-build prerender: renders the landing page to static HTML and injects it
// into dist/index.html's #app div, so crawlers (and users on slow connections)
// get real content before any JS runs. The client-side Preact render reuses or
// replaces this DOM on mount; authenticated users see it only for the moment
// it takes the bundle to load.
//
// Runs after `vite build` (see the "build" script in package.json). Modifying
// dist/index.html after the PWA plugin has generated the service worker is
// safe: Workbox uses the revision only as a cache-busting query param, not as
// an integrity check.
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { renderLandingPage } = await server.ssrLoadModule('/src/prerender-entry.jsx');
  const appHtml = renderLandingPage();

  const indexPath = new URL('../dist/index.html', import.meta.url);
  const indexHtml = await readFile(indexPath, 'utf8');
  const marker = '<div id="app"></div>';
  if (!indexHtml.includes(marker)) {
    throw new Error('dist/index.html: could not find empty #app div to inject prerendered HTML into');
  }
  await writeFile(indexPath, indexHtml.replace(marker, `<div id="app">${appHtml}</div>`));
  console.log(`Prerendered landing page into dist/index.html (${(appHtml.length / 1024).toFixed(1)} kB)`);
} finally {
  await server.close();
}
