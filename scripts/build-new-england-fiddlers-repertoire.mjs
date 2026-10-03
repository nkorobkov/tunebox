// Generates the standalone New England Fiddler's Repertoire index page:
//   public/new-england-fiddlers-repertoire/index.html     — full static tune list
//   public/new-england-fiddlers-repertoire/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/new-england-fiddlers-repertoire/tunes.json — the 168
// tunes of Randy Miller & Jack Perron's "New England Fiddler's Repertoire"
// (NEFR, 1983), numbered as in the book, with ABC from John Chambers' NEFR
// project (trillian.mit.edu/~jc/music/abc/Contra/NEFR/, via the Internet
// Archive): community transcriptions of these mostly traditional tunes, picked
// and edited to sit close to the NEFR versions — not the book's own notation.
// Matched to thesession.org (TheSession-data dump) by name and by comparing the
// opening bars against every setting there. `match`: 'exact' melody,
// 'name' + partial melody, 'approx' → ≈, 'none'.
// Run manually after updating the data: node scripts/build-new-england-fiddlers-repertoire.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'new-england-fiddlers-repertoire', 'tunes.json'), 'utf8'));
const archive = 'https://web.archive.org/web/2026/https://trillian.mit.edu/~jc/music/abc/Contra/NEFR/HEADER';

writeTuneIndexPage({
  root,
  slug: 'new-england-fiddlers-repertoire',
  generator: 'scripts/build-new-england-fiddlers-repertoire.mjs',
  tunes,
  ordered: true, // records are in book order
  bookChip: (t) => `No. ${t.no}`,
  siteTitle: 'New England Fiddler&rsquo;s Repertoire &middot; Tune index',
  title: (s) => `New England Fiddler's Repertoire (NEFR) tune index — all ${s.total} tunes`,
  ogTitle: (s) => `New England Fiddler's Repertoire — all ${s.total} tunes, searchable`,
  description: (s) => `A free searchable index of all ${s.total} jigs, reels, hornpipes and marches in the New England Fiddler's Repertoire (NEFR) by Randy Miller and Jack Perron — the core contra dance repertoire — with book numbers, sheet music and playback, and links to the ${s.linked} found on thesession.org.`,
  jsonLdName: "New England Fiddler's Repertoire tune index",
  about: {
    '@type': 'Book',
    name: "New England Fiddler's Repertoire",
    alternateName: 'NEFR',
    author: [{ '@type': 'Person', name: 'Randy Miller' }, { '@type': 'Person', name: 'Jack Perron' }],
    datePublished: '1983',
  },
  h1: 'New England Fiddler&rsquo;s Repertoire <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable, unofficial index of all ${s.total} tunes in Randy Miller and Jack Perron&rsquo;s
      <em>New England Fiddler&rsquo;s Repertoire</em> (NEFR) &mdash; the jigs, reels, hornpipes and marches every
      musician playing for New England contra dances is expected to know. Sort by book order to browse it by
      number.</p>
      <p>Sheet music and playback come from John Chambers&rsquo; collection of community transcriptions chosen to
      sit close to the NEFR versions; ${s.linked} tunes also link to
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>.</p>`,
  buyHtml: `<h2>The book</h2>
      <a href="https://canaaninstitute.org/home/product/new-england-fiddlers-repertoire-3rd-edition-nefr3/" target="_blank" rel="noopener">Buy NEFR (3rd edition)</a>
      <a href="${archive}" target="_blank" rel="noopener">ABC transcriptions</a>`,
  promoHeading: 'Learning the NEFR tunes?',
  notationNote: 'Community transcription chosen to be close to the NEFR version — buy the book for the real thing',
  statsHtml: (s) => `${s.total} tunes &middot; ${s.linked} matched on thesession.org &middot; sheet music &amp; playback for every tune`,
  creditsHtml: `Notation from John Chambers&rsquo;
    <a href="${archive}" target="_blank" rel="noopener">NEFR ABC project</a>
    &middot; links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
  footerCopyright: `<em>New England Fiddler&rsquo;s Repertoire</em> is &copy; Randy Miller and Jack Perron. This independent
    index is not affiliated with the authors or with thesession.org &mdash; please buy the book.`,
});
