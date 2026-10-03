// Generates the standalone Skye Collection index page:
//   public/skye-collection/index.html     — full static tune list
//   public/skye-collection/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/skye-collection/tunes.json — every tune in Keith Norman
// MacDonald's "The Skye Collection of Best Reels and Strathspeys" (1887; public
// domain) as ABC from Ralph Palmer's transcription (trillian.mit.edu/~jc/music/
// book/Skye/, via the Internet Archive), in book order, matched to thesession.org
// (TheSession-data dump) by name and by comparing the opening bars against every
// setting there. `match`: 'exact' melody, 'name' + partial melody, 'approx' →
// shown as ≈, 'none'.
// Run manually after updating the data: node scripts/build-skye-collection.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'skye-collection', 'tunes.json'), 'utf8'));
const archive = 'https://web.archive.org/web/2010/http://trillian.mit.edu/~jc/music/book/Skye/';

writeTuneIndexPage({
  root,
  slug: 'skye-collection',
  generator: 'scripts/build-skye-collection.mjs',
  tunes,
  ordered: true, // records are in book order
  bookChip: (t) => `No. ${t.no}`,
  siteTitle: 'The Skye Collection &middot; Tune index',
  title: (s) => `The Skye Collection tune index — all ${s.total} reels and strathspeys, with sheet music`,
  ogTitle: (s) => `The Skye Collection — all ${s.total} tunes, searchable, with sheet music`,
  description: (s) => `A free searchable index of all ${s.total} tunes in Keith Norman MacDonald's Skye Collection of Best Reels and Strathspeys (1887), a cornerstone of Scottish and Cape Breton fiddling, with the book's own sheet music and playback for every tune and links to the ${s.linked} found on thesession.org.`,
  jsonLdName: 'Skye Collection tune index',
  about: {
    '@type': 'Book',
    name: 'The Skye Collection of Best Reels and Strathspeys',
    author: { '@type': 'Person', name: 'Keith Norman MacDonald' },
    datePublished: '1887',
  },
  h1: 'The Skye Collection <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable index of all ${s.total} tunes in Keith Norman MacDonald&rsquo;s <em>The Skye
      Collection of Best Reels and Strathspeys</em> (1887) &mdash; the Highland fiddle repertoire that became a
      cornerstone of Scottish and Cape Breton fiddling. Sort by number to browse it in order, and open any tune for
      the book&rsquo;s own setting with playback.</p>
      <p>${s.linked} tunes link to their page on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, where many go by other
      names &mdash; those are shown under the title.</p>`,
  buyHtml: `<h2>The book</h2>
      <a href="https://digital.nls.uk/special-collections-of-printed-music/archive/105831316" target="_blank" rel="noopener">Scan (National Library of Scotland)</a>
      <a href="${archive}" target="_blank" rel="noopener">ABC transcriptions</a>`,
  promoHeading: 'Learning tunes from the Skye Collection?',
  notationNote: 'MacDonald’s own setting (1887), from the book — session versions often differ',
  statsHtml: (s) => `${s.total} tunes &middot; ${s.linked} matched on thesession.org &middot; sheet music &amp; playback for every tune`,
  creditsHtml: `Notation transcribed from the book by Ralph Palmer
    (<a href="${archive}" target="_blank" rel="noopener">ABC files</a>)
    &middot; links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
  footerCopyright: `<em>The Skye Collection</em> (1887) is in the public domain.
    This is an independent index, not affiliated with thesession.org.`,
});
