// Generates the standalone Portland Collection index page:
//   public/portland-collection/index.html     — full static tune list
//   public/portland-collection/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/portland-collection/tunes.json (built from the
// theportlandcollection.com tune lists matched against thesession.org).
// Run manually after updating the data: node scripts/build-portland-collection.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'portland-collection', 'tunes.json'), 'utf8'));

writeTuneIndexPage({
  root,
  slug: 'portland-collection',
  generator: 'scripts/build-portland-collection.mjs',
  tunes,
  books: [1, 2, 3].map((n) => ({ value: n, label: `Book ${n}` })),
  bookChip: (t) => `Book ${t.book}`,
  siteTitle: 'The Portland Collection &middot; Tune index',
  title: (s) => `The Portland Collection tune index — search all ${s.total} tunes (Vols. 1–3)`,
  ogTitle: (s) => `The Portland Collection tune index — all ${s.total} tunes, searchable`,
  description: (s) => `A free searchable index of all ${s.total} tunes in The Portland Collection — contra dance music from Portland, Oregon, compiled by Sue Songer and Clyde Curley — with sheet music and audio playback for the ${s.playable} tunes found on thesession.org.`,
  jsonLdName: 'The Portland Collection tune index',
  about: {
    '@type': 'BookSeries',
    name: 'The Portland Collection: Contra Dance Music in the Pacific Northwest',
    author: [
      { '@type': 'Person', name: 'Sue Songer' },
      { '@type': 'Person', name: 'Clyde Curley' },
    ],
    url: 'https://www.theportlandcollection.com/',
  },
  h1: 'The Portland Collection <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable, unofficial index of ${s.total} tunes in <em>The Portland Collection: Contra Dance Music
      in the Pacific Northwest</em> (volumes 1&ndash;3, compiled by Sue Songer and Clyde Curley), with sheet music
      and playback for the ${s.playable} tunes matched on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>.</p>`,
  buyHtml: `<h2>Buy the books</h2>
      <a href="https://www.theportlandcollection.com/portland-collection-1-revised-edition/" target="_blank" rel="noopener">Volume 1 (revised)</a>
      <a href="https://www.theportlandcollection.com/portland-collection-2-2/" target="_blank" rel="noopener">Volume 2</a>
      <a href="https://www.theportlandcollection.com/portland-collection-volume-3/" target="_blank" rel="noopener">Volume 3</a>
      <a href="https://www.theportlandcollection.com/wp-content/uploads/2015/07/All-Tunes.pdf" target="_blank" rel="noopener">Official tune list (PDF)</a>`,
  promoHeading: 'Learning tunes from the Portland Collection?',
  footerCopyright: `<em>The Portland Collection</em> is &copy; Sue Songer &amp; Clyde Curley. This independent index lists tune
    names only and is not affiliated with or endorsed by the compilers &mdash; please
    <a href="https://www.theportlandcollection.com/" target="_blank" rel="noopener">buy the books</a> for the real thing.`,
});
