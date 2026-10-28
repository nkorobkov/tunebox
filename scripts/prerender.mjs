// Post-build prerender: renders the landing page to static HTML and injects it
// into dist/index.html's #app div, so crawlers (and users on slow connections)
// get real content before any JS runs. The sheet music scanner gets its own copy
// of the app shell, dist/play-sheet-music/index.html, with its own title, meta
// tags and structured data (without it GitHub Pages would serve that route from
// 404.html, with a 404 status and the landing page's title, so it couldn't be
// indexed), and its old address /parse-abc gets a redirect page. The client-side Preact render reuses or
// replaces this DOM on mount; authenticated users see it only for the moment
// it takes the bundle to load.
//
// Runs after `vite build` (see the "build" script in package.json). Modifying
// dist/index.html after the PWA plugin has generated the service worker is
// safe: Workbox uses the revision only as a cache-busting query param, not as
// an integrity check.
import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const SITE = 'https://tunebox.net';
const SCANNER_PATH = '/play-sheet-music/';
const SCANNER_TITLE = 'Sheet music scanner: play sheet music from a photo or PDF | TuneBox';
const SCANNER_SOCIAL_TITLE = 'Play sheet music from a photo';
const SCANNER_DESCRIPTION = 'Take a photo of printed sheet music and hear it played. TuneBox reads '
  + 'the notes and chords, plays the tune at any speed, and gives you notation to edit, transpose '
  + 'or export as ABC. Works on phone photos, scans and PDFs.';

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Replaces exactly one match of `pattern` in `html`, failing the build if index.html
// changed shape so that a tag would silently keep the landing page's value.
function replaceOne(html, pattern, replacement) {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g'));
  if (matches?.length !== 1) throw new Error(`index.html: expected one match for ${pattern}, found ${matches?.length ?? 0}`);
  return html.replace(pattern, replacement);
}

function scannerHead(html, faq) {
  const url = SITE + SCANNER_PATH;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'TuneBox sheet music scanner',
        url,
        description: SCANNER_DESCRIPTION,
        applicationCategory: 'MusicApplication',
        operatingSystem: 'Any (web browser)',
        isPartOf: { '@type': 'WebSite', name: 'TuneBox', url: SITE + '/' },
        featureList: [
          'Reads printed sheet music from a photo, scan or PDF',
          'Plays the tune back with adjustable speed and looping',
          'Recognizes chord symbols',
          'Transposes to any key',
          'Exports ABC notation',
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(({ q, a }) => ({
          '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  };
  const swaps = [
    [/<title>[^<]*<\/title>/, `<title>${escAttr(SCANNER_TITLE)}</title>`],
    [/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escAttr(SCANNER_DESCRIPTION)}" />`],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`],
    [/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escAttr(SCANNER_SOCIAL_TITLE)}" />`],
    [/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escAttr(SCANNER_DESCRIPTION)}" />`],
    [/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escAttr(SCANNER_SOCIAL_TITLE)}" />`],
    [/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escAttr(SCANNER_DESCRIPTION)}" />`],
    [/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2).replace(/</g, '\\u003c')}\n</script>`],
  ];
  return swaps.reduce((h, [pattern, replacement]) => replaceOne(h, pattern, () => replacement), html);
}

// Old address: a static redirect (GitHub Pages can't send real ones)
const OLD_SCANNER_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sheet music scanner | TuneBox</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}${SCANNER_PATH}">
<meta http-equiv="refresh" content="0; url=${SCANNER_PATH}">
</head>
<body><p>This page has moved to <a href="${SCANNER_PATH}">${SITE}${SCANNER_PATH}</a>.</p></body>
</html>
`;

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { renderLandingPage, renderScannerPage, SCANNER_FAQ } = await server.ssrLoadModule('/src/prerender-entry.jsx');
  const appHtml = renderLandingPage();

  const indexPath = new URL('../dist/index.html', import.meta.url);
  const indexHtml = await readFile(indexPath, 'utf8');
  const marker = '<div id="app"></div>';
  if (!indexHtml.includes(marker)) {
    throw new Error('dist/index.html: could not find empty #app div to inject prerendered HTML into');
  }
  await writeFile(indexPath, indexHtml.replace(marker, `<div id="app">${appHtml}</div>`));
  console.log(`Prerendered landing page into dist/index.html (${(appHtml.length / 1024).toFixed(1)} kB)`);

  const scannerHtml = renderScannerPage();
  const scannerDir = new URL('../dist' + SCANNER_PATH, import.meta.url);
  await mkdir(scannerDir, { recursive: true });
  await writeFile(new URL('index.html', scannerDir),
    scannerHead(indexHtml, SCANNER_FAQ).replace(marker, `<div id="app">${scannerHtml}</div>`));
  console.log(`Prerendered the sheet music scanner into dist${SCANNER_PATH}index.html (${(scannerHtml.length / 1024).toFixed(1)} kB)`);

  const oldDir = new URL('../dist/parse-abc/', import.meta.url);
  await mkdir(oldDir, { recursive: true });
  await writeFile(new URL('index.html', oldDir), OLD_SCANNER_PAGE);
} finally {
  await server.close();
}
