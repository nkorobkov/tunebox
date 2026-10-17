import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves in src/lib/sw-update.js so the plugin
      // doesn't inject an inline <script> that violates our CSP.
      injectRegister: false,
      manifest: false, // public/manifest.json is already linked from index.html
      devOptions: { enabled: false },
      workbox: {
        // vite-plugin-pwa only injects these two for `autoUpdate` when it also
        // injects the registration script; with `injectRegister: false` it
        // silently doesn't, so every deploy installed and then parked in
        // "waiting" forever and the app never picked it up. Set them by hand.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,mp3}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Never serve the app shell for real static files (robots.txt and
        // sitemap.xml aren't precached, so without this the SW hijacks
        // browser navigations to them). Same for the standalone tune-index
        // pages (Portland Collection, Foinn Seisiún).
        navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/collections/, /^\/portland-collection/, /^\/foinn-seisiun/, /^\/oneills-1001/, /^\/ryans-mammoth-collection/, /^\/ceol-rince-na-heireann/, /^\/kerrs-merry-melodies/, /^\/skye-collection/, /^\/athole-collection/, /^\/new-england-fiddlers-repertoire/, /^\/irish-session-tunes/, /^\/110-irelands-best-session-tunes/],
        // Don't precache .map files or other dev artifacts. The tesseract
        // and pdf.js assets (~15MB), the abcjs copy, and the standalone
        // tune-index pages (~700KB each) are lazy-loaded on demand, not precached.
        // Soundfonts: piano and the generated backing's core band (bass,
        // steel guitar, percussion) are precached so playback works offline;
        // the optional instruments are cached the first time they're used.
        globIgnores: ['soundfonts/FluidR3_GM/acoustic_guitar_nylon-mp3/**', 'soundfonts/FluidR3_GM/violin-mp3/**', 'soundfonts/FluidR3_GM/flute-mp3/**', '**/node_modules/**/*', 'sw.js', 'workbox-*.js', 'tesseract/**', 'pdfjs/**', 'abcjs/**', 'tune-index/**', 'collections/**', 'portland-collection/**', 'foinn-seisiun/**', 'oneills-1001/**', 'ryans-mammoth-collection/**', 'ceol-rince-na-heireann/**', 'kerrs-merry-melodies/**', 'skye-collection/**', 'athole-collection/**', 'new-england-fiddlers-repertoire/**', 'irish-session-tunes/**', '110-irelands-best-session-tunes/**'],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/soundfonts/'),
          handler: 'CacheFirst',
          options: { cacheName: 'soundfonts', expiration: { maxEntries: 600 } },
        }],
      },
    }),
  ],
})
