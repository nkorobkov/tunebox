// Generates the standalone 110 Ireland's Best Session Tunes index page:
//   public/110-irelands-best-session-tunes/index.html     — full static tune list
//   public/110-irelands-best-session-tunes/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/110-irelands-best-session-tunes/tunes.json — the tunes of
// Waltons' "110 Ireland's Best Session Tunes" volume 1, taken from its two
// companion CDs' track listings on thesession.org (recordings 2108, 2109), in
// CD order; `track` is disc.track. `abc` is each tune's first setting on
// thesession; tracks with no tune there are listed without a link.
// Run manually after updating the data: node scripts/build-110-irelands-best-session-tunes.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', '110-irelands-best-session-tunes', 'tunes.json'), 'utf8'));

writeTuneIndexPage({
  root,
  slug: '110-irelands-best-session-tunes',
  generator: 'scripts/build-110-irelands-best-session-tunes.mjs',
  tunes,
  ordered: true, // records are in CD order
  bookChip: (t) => `CD ${t.track.replace('.', ' · track ')}`,
  siteTitle: '110 Ireland&rsquo;s Best Session Tunes &middot; Tune index',
  title: (s) => `110 Ireland's Best Session Tunes (Waltons) tune index — volume 1`,
  ogTitle: (s) => `110 Ireland's Best Session Tunes — ${s.total} tunes, searchable`,
  description: (s) => `A free searchable index of the ${s.total} tunes on the CDs of Waltons' 110 Ireland's Best Session Tunes, volume 1 — reels, jigs, hornpipes, polkas and more — with sheet music and audio playback and links to thesession.org.`,
  jsonLdName: "110 Ireland's Best Session Tunes tune index",
  about: {
    '@type': 'Book',
    name: "110 Ireland's Best Session Tunes",
    publisher: { '@type': 'Organization', name: 'Waltons' },
  },
  h1: '110 Ireland&rsquo;s Best Session Tunes <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable, unofficial index of ${s.total} tunes from Waltons&rsquo; <em>110 Ireland&rsquo;s Best
      Session Tunes</em>, volume 1 &mdash; the popular session reels, jigs, hornpipes and polkas, as listed on the
      book&rsquo;s two companion CDs. Sort by book order to follow the CDs.</p>
      <p>Sheet music and playback use the first setting on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, so details may differ from the book.</p>`,
  buyHtml: `<h2>Buy the book</h2>
      <a href="https://www.halleonard.com/product/634214/110-irelands-best-session-tunes-volume-1" target="_blank" rel="noopener">Volume 1 (Hal Leonard)</a>`,
  promoHeading: 'Learning Ireland&rsquo;s best session tunes?',
  footerCopyright: `<em>110 Ireland&rsquo;s Best Session Tunes</em> is &copy; Waltons. This independent index lists tune
    names only and is not affiliated with or endorsed by Waltons &mdash; please buy the book and CDs.`,
});
