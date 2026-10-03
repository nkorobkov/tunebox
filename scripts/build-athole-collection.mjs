// Generates the standalone Athole Collection index page:
//   public/athole-collection/index.html     — full static tune list
//   public/athole-collection/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/athole-collection/tunes.json — the tunes of James
// Stewart-Robertson's "The Athole Collection of the Dance Music of Scotland"
// (1884; public domain) as ABC from Hans Bracker's transcription (2002; mirrored
// at trillian.mit.edu/~jc/music/book/Athole/, via the Internet Archive and
// abcnotation.com), matched to thesession.org (TheSession-data dump) by name and
// by comparing the opening bars against every setting there. The transcription
// is numbered alphabetically, not in book order, so there is no book-order sort.
// `match`: 'exact' melody, 'name' + partial melody, 'approx' → ≈, 'none'.
// Run manually after updating the data: node scripts/build-athole-collection.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'athole-collection', 'tunes.json'), 'utf8'));
const archive = 'https://web.archive.org/web/2024/http://trillian.mit.edu/~jc/music/book/Athole/';

writeTuneIndexPage({
  root,
  slug: 'athole-collection',
  generator: 'scripts/build-athole-collection.mjs',
  tunes,
  siteTitle: 'The Athole Collection &middot; Tune index',
  title: (s) => `The Athole Collection tune index — ${s.total} Scottish dance tunes, with sheet music`,
  ogTitle: (s) => `The Athole Collection — ${s.total} tunes, searchable, with sheet music`,
  description: (s) => `A free searchable index of ${s.total} tunes in James Stewart-Robertson's Athole Collection of the Dance Music of Scotland (1884) — strathspeys, reels, jigs and more — with the book's own sheet music and playback for every tune and links to the ${s.linked} found on thesession.org.`,
  jsonLdName: 'Athole Collection tune index',
  about: {
    '@type': 'Book',
    name: 'The Athole Collection of the Dance Music of Scotland',
    author: { '@type': 'Person', name: 'James Stewart-Robertson' },
    datePublished: '1884',
  },
  h1: 'The Athole Collection <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable index of ${s.total} tunes in James Stewart-Robertson&rsquo;s <em>The Athole
      Collection of the Dance Music of Scotland</em> (1884) &mdash; strathspeys, reels, jigs, marches and airs, one
      of the great sources of the Scottish and Cape Breton fiddle repertoire. Open any tune for the book&rsquo;s own
      setting with playback.</p>
      <p>${s.linked} tunes link to their page on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, where many go by other
      names &mdash; those are shown under the title.</p>`,
  buyHtml: `<h2>The book</h2>
      <a href="${archive}" target="_blank" rel="noopener">ABC transcriptions</a>
      <a href="https://en.wikipedia.org/wiki/Strathspey_(dance)" target="_blank" rel="noopener">About strathspeys</a>`,
  promoHeading: 'Learning tunes from the Athole Collection?',
  notationNote: 'Stewart-Robertson’s setting (1884), from the book — session versions often differ',
  statsHtml: (s) => `${s.total} tunes &middot; ${s.linked} matched on thesession.org &middot; sheet music &amp; playback for every tune`,
  creditsHtml: `Notation transcribed from the book by Hans Bracker
    (<a href="${archive}" target="_blank" rel="noopener">ABC files</a>)
    &middot; links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
  footerCopyright: `<em>The Athole Collection</em> (1884) is in the public domain.
    This is an independent index, not affiliated with thesession.org.`,
});
