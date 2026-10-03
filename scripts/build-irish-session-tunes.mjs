// Generates the standalone Irish Session Tunes (Ossian) index page:
//   public/irish-session-tunes/index.html     — full static tune list
//   public/irish-session-tunes/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/irish-session-tunes/tunes.json — the tunes of Ossian's
// "Irish Session Tunes" Green, Red, Blue and Orange books, taken from the
// companion CDs' track listings on thesession.org (recordings 483+484, 4137,
// 735, 6575 — the Red Book CD carries about half the book), in CD order;
// `track` is the CD track. `abc` is each tune's first setting on thesession;
// tracks with no tune there are listed without a link.
// Run manually after updating the data: node scripts/build-irish-session-tunes.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'irish-session-tunes', 'tunes.json'), 'utf8'));
const label = ['', 'Green Book', 'Red Book', 'Blue Book', 'Orange Book'];

writeTuneIndexPage({
  root,
  slug: 'irish-session-tunes',
  generator: 'scripts/build-irish-session-tunes.mjs',
  tunes,
  ordered: true, // records are in CD order
  books: [1, 2, 3, 4].map((n) => ({ value: n, label: label[n] })),
  bookChip: (t) => `${label[t.book]} · CD track ${t.track}`,
  siteTitle: 'Irish Session Tunes &middot; Tune index',
  title: (s) => `Irish Session Tunes (Ossian) tune index — Green, Red, Blue & Orange books`,
  ogTitle: (s) => `Irish Session Tunes — ${s.total} tunes from the Ossian books, searchable`,
  description: (s) => `A free searchable index of ${s.total} tunes from Ossian's Irish Session Tunes books (the Green, Red, Blue and Orange books), taken from their companion CDs, with sheet music and audio playback and links to thesession.org.`,
  jsonLdName: 'Irish Session Tunes tune index',
  about: {
    '@type': 'BookSeries',
    name: 'Irish Session Tunes',
    alternateName: 'Ceolta Seisiún na hÉireann',
    publisher: { '@type': 'Organization', name: 'Ossian Publications' },
  },
  h1: 'Irish Session Tunes <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable, unofficial index of ${s.total} tunes from Ossian&rsquo;s <em>Irish Session
      Tunes</em> books &mdash; the Green, Red, Blue and Orange books of jigs, reels, polkas, slides, hornpipes and
      airs that many learners start their session repertoire with. The list follows the books&rsquo; companion CDs
      (the Red Book CD carries about half of its book); sort by book order to see the sets as recorded.</p>
      <p>Sheet music and playback use the first setting on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, so details may differ from the books.</p>`,
  buyHtml: `<h2>Buy the books</h2>
      <a href="https://mcneelamusic.com/music-books/irish-sessions-tunes-the-green-book/" target="_blank" rel="noopener">The Green Book</a>
      <a href="https://ossianusa.com/products/irish-session-tunes-the-red-book" target="_blank" rel="noopener">The Red Book</a>
      <a href="https://mcneelamusic.com/music-books/irish-session-tunes-the-blue-book/" target="_blank" rel="noopener">The Blue Book</a>`,
  promoHeading: 'Learning the Irish Session Tunes sets?',
  footerCopyright: `<em>Irish Session Tunes</em> is &copy; Ossian Publications. This independent index lists tune
    names only and is not affiliated with or endorsed by Ossian &mdash; please buy the books and CDs.`,
});
