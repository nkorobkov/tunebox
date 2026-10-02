// Generates the standalone Ryan's Mammoth Collection index page:
//   public/ryans-mammoth-collection/index.html     — full static tune list
//   public/ryans-mammoth-collection/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/ryans-mammoth-collection/tunes.json — the tunes of
// William Bradbury Ryan's "Ryan's Mammoth Collection" (Elias Howe, Boston, 1883;
// public domain, later reissued as Cole's "1000 Fiddle Tunes") as ABC from John
// Chambers' Ryan/Cole transcription project (trillian.mit.edu/~jc/music/book/
// ryan-cole/, via the Internet Archive), de-duplicated, matched to
// thesession.org (TheSession-data dump) by name and by comparing the opening
// bars of the melody against every setting there. `url` points at the closest
// setting; `match` records how ('exact' melody, 'name' + partial melody,
// 'approx' → shown as ≈, 'none'). The notation shown is the book's own.
// The book has no tune numbers, so there is no book-order sort.
// Run manually after updating the data: node scripts/build-ryans-mammoth-collection.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'ryans-mammoth-collection', 'tunes.json'), 'utf8'));
const archive = 'https://web.archive.org/web/2021/http://trillian.mit.edu/~jc/music/book/ryan-cole/';

writeTuneIndexPage({
  root,
  slug: 'ryans-mammoth-collection',
  generator: 'scripts/build-ryans-mammoth-collection.mjs',
  tunes,
  siteTitle: 'Ryan&rsquo;s Mammoth Collection &middot; Tune index',
  title: (s) => `Ryan's Mammoth Collection tune index — all ${s.total} tunes, with sheet music`,
  ogTitle: (s) => `Ryan's Mammoth Collection — all ${s.total} tunes, searchable, with sheet music`,
  description: (s) => `A free searchable index of the ${s.total} reels, jigs, hornpipes, clogs and strathspeys in Ryan's Mammoth Collection (1883) — the book later sold as Cole's 1000 Fiddle Tunes — with the book's own sheet music and audio playback for every tune and links to the ${s.linked} found on thesession.org.`,
  jsonLdName: "Ryan's Mammoth Collection tune index",
  about: {
    '@type': 'Book',
    name: "Ryan's Mammoth Collection",
    alternateName: "Cole's 1000 Fiddle Tunes",
    author: { '@type': 'Person', name: 'William Bradbury Ryan' },
    publisher: { '@type': 'Organization', name: 'Elias Howe' },
    datePublished: '1883',
  },
  h1: 'Ryan&rsquo;s Mammoth Collection <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable index of the ${s.total} tunes in William Bradbury Ryan&rsquo;s <em>Mammoth
      Collection</em> (Boston, 1883) &mdash; reels, jigs, hornpipes, clogs, strathspeys and walkarounds played in
      19th-century America, reissued in 1940 as <em>Cole&rsquo;s 1000 Fiddle Tunes</em> and still known as
      &ldquo;the fiddler&rsquo;s bible&rdquo;. Open any tune for the book&rsquo;s own setting with playback.</p>
      <p>${s.linked} tunes link to their page on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, where many go by other
      names &mdash; those are shown under the title.</p>`,
  buyHtml: `<h2>The book</h2>
      <a href="https://books.google.com/books/about/Ryan_s_Mammoth_Collection_of_Fiddle_Tune.html?id=gbQECAAAQBAJ" target="_blank" rel="noopener">Mel Bay edition (Patrick Sky)</a>
      <a href="${archive}" target="_blank" rel="noopener">ABC transcriptions</a>
      <a href="http://www.ibiblio.org/fiddlers/ryan1.htm" target="_blank" rel="noopener">About the collection</a>`,
  promoHeading: 'Learning tunes from Ryan&rsquo;s?',
  notationNote: 'Ryan’s own setting (1883), from the book — session versions often differ',
  statsHtml: (s) => `${s.total} tunes &middot; ${s.linked} matched on thesession.org &middot; sheet music &amp; playback for every tune`,
  creditsHtml: `Notation transcribed from the book by John Chambers and contributors to the
    <a href="${archive}" target="_blank" rel="noopener">Ryan/Cole ABC project</a>
    &middot; links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
  footerCopyright: `<em>Ryan&rsquo;s Mammoth Collection</em> (1883) is in the public domain.
    This is an independent index, not affiliated with thesession.org.`,
});
