// Generates the standalone Foinn Seisiún (Session Tunes) index page:
//   public/foinn-seisiun/index.html     — full static tune list
//   public/foinn-seisiun/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/foinn-seisiun/tunes.json — the Comhaltas tune index
// (media.comhaltas.ie/docs/FoinnSeisiunIndex.pdf: book + page per tune),
// matched to thesession.org through the Foinn Seisiún 1–3 CD track listings
// there (recordings 1227, 1587, 2998), which record the books' sets in order.
// Records are in book order; `sessionName` is the tune's name on thesession
// and `abc` its first setting there.
// Run manually after updating the data: node scripts/build-foinn-seisiun.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'foinn-seisiun', 'tunes.json'), 'utf8'));
const roman = ['', 'I', 'II', 'III'];

writeTuneIndexPage({
  root,
  slug: 'foinn-seisiun',
  generator: 'scripts/build-foinn-seisiun.mjs',
  tunes,
  books: [1, 2, 3].map((n) => ({ value: n, label: `Book ${roman[n]}` })),
  bookChip: (t) => `Book ${roman[t.book]} · p. ${t.page}`,
  availFilter: false, // every tune is matched on thesession
  siteTitle: 'Foinn Seisi&uacute;n &middot; Tune index',
  title: (s) => `Foinn Seisiún / Session Tunes tune index — all ${s.total} tunes (Books 1–3)`,
  ogTitle: (s) => `Foinn Seisiún tune index — all ${s.total} tunes, searchable`,
  description: (s) => `A free searchable index of all ${s.total} tunes in Foinn Seisiún (Session Tunes) books 1–3 by Comhaltas Ceoltóirí Éireann, compiled by Brian Prior — with book and page numbers, sheet music and audio playback for every tune.`,
  jsonLdName: 'Foinn Seisiún tune index',
  about: {
    '@type': 'BookSeries',
    name: 'Foinn Seisiún',
    alternateName: 'Session Tunes',
    author: { '@type': 'Person', name: 'Brian Prior' },
    publisher: { '@type': 'Organization', name: 'Comhaltas Ceoltóirí Éireann', url: 'https://comhaltas.ie/' },
    url: 'https://comhaltas.ie/music-more/session-tunes-foinn-seisiun/',
  },
  h1: 'Foinn Seisi&uacute;n <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable, unofficial index of all ${s.total} tunes in <em>Foinn Seisi&uacute;n</em>
      (<em>Session Tunes</em>) books 1&ndash;3 from Comhaltas Ceolt&oacute;ir&iacute; &Eacute;ireann, compiled by
      Brian Prior &mdash; the sets of favourite session tunes many Irish music classes learn from. Each tune shows its
      book and page; sort by book order to see the sets as printed.</p>
      <p>Sheet music and playback use the first setting on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, so details may differ from the book.</p>`,
  buyHtml: `<h2>Buy the books</h2>
      <a href="https://comhaltas.ie/product/foinn-seisiun-1/" target="_blank" rel="noopener">Foinn Seisi&uacute;n 1</a>
      <a href="https://comhaltas.ie/product/foinn-seisiun-2/" target="_blank" rel="noopener">Foinn Seisi&uacute;n 2</a>
      <a href="https://comhaltas.ie/product/foinn-seisiun-3/" target="_blank" rel="noopener">Foinn Seisi&uacute;n 3</a>
      <a href="https://media.comhaltas.ie/docs/FoinnSeisiunIndex.pdf" target="_blank" rel="noopener">Official tune index (PDF)</a>`,
  promoHeading: 'Learning the Foinn Seisiún sets?',
  footerCopyright: `<em>Foinn Seisi&uacute;n</em> is &copy; Comhaltas Ceolt&oacute;ir&iacute; &Eacute;ireann. This independent index lists tune
    names only and is not affiliated with or endorsed by Comhaltas &mdash; please
    <a href="https://comhaltas.ie/music-more/session-tunes-foinn-seisiun/" target="_blank" rel="noopener">buy the books and CDs</a> for the real thing.`,
});
