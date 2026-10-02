// Generates the standalone Ceol Rince na hÉireann 1–5 index page:
//   public/ceol-rince-na-heireann/index.html     — full static tune list
//   public/ceol-rince-na-heireann/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/ceol-rince-na-heireann/tunes.json — every numbered tune
// in Breandán Breathnach's five volumes, with the names from Paul de Grae's
// tune-name index (nigelgatherer.com/museum/bo/cre/crex.html). Each tune was
// matched to thesession.org (TheSession-data dump) by name and by comparing the
// opening bars of Bill Black's ABC transcription of the book (Irish Traditional
// Tune Library, capeirish.com/ittl) against every setting there. `abc` is the
// closest-matching thesession setting; tunes not on thesession use Bill Black's
// ABC instead and link to its ITTL page (`source`). `match` records how the
// link was chosen ('exact' melody, 'name' + partial melody, 'approx' → shown
// as ≈, 'none').
// Run manually after updating the data: node scripts/build-ceol-rince-na-heireann.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'ceol-rince-na-heireann', 'tunes.json'), 'utf8'));
const roman = ['', 'I', 'II', 'III', 'IV', 'V'];

writeTuneIndexPage({
  root,
  slug: 'ceol-rince-na-heireann',
  generator: 'scripts/build-ceol-rince-na-heireann.mjs',
  tunes,
  ordered: true, // records are in book order
  books: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `CRÉ ${roman[n]}` })),
  bookChip: (t) => `CRÉ ${roman[t.book]} · No. ${t.no}`,
  siteTitle: 'Ceol Rince na h&Eacute;ireann &middot; Tune index',
  title: (s) => `Ceol Rince na hÉireann tune index — all ${s.total} tunes in volumes 1–5`,
  ogTitle: (s) => `Ceol Rince na hÉireann 1–5 — all ${s.total} tunes, searchable`,
  description: (s) => `A free searchable index of all ${s.total} tunes in Breandán Breathnach's Ceol Rince na hÉireann volumes 1–5 (CRÉ), with every Irish and English title from the books, tune numbers, and sheet music with playback for ${s.playable}, linked to ${s.linked} of them on thesession.org.`,
  jsonLdName: 'Ceol Rince na hÉireann tune index',
  about: {
    '@type': 'BookSeries',
    name: 'Ceol Rince na hÉireann',
    alternateName: 'CRÉ',
    author: { '@type': 'Person', name: 'Breandán Breathnach' },
  },
  h1: 'Ceol Rince na h&Eacute;ireann <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable, unofficial index of all ${s.total} tunes in Breand&aacute;n Breathnach&rsquo;s
      <em>Ceol Rince na h&Eacute;ireann</em> volumes 1&ndash;5 &mdash; the landmark collection of Irish dance music
      gathered from traditional players. Search by any of the Irish or English titles the books give, filter by
      volume, and sort by book order to browse each volume by tune number.</p>
      <p>${s.linked} tunes link to their closest match on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>; sheet music and playback use
      that setting, so details may differ from the book. Most of the rest have Bill Black&rsquo;s transcription from
      the <a href="https://www.capeirish.com/ittl/" target="_blank" rel="noopener">Irish Traditional Tune Library</a>.</p>`,
  buyHtml: `<h2>About the books</h2>
      <a href="https://en.wikipedia.org/wiki/Breand%C3%A1n_Breathnach" target="_blank" rel="noopener">Breand&aacute;n Breathnach</a>
      <a href="https://nigelgatherer.com/museum/bo/cre/crex.html" target="_blank" rel="noopener">Index of tune names</a>
      <a href="https://www.capeirish.com/ittl/" target="_blank" rel="noopener">Irish Traditional Tune Library</a>`,
  promoHeading: 'Learning tunes from CRÉ?',
  notationNote: 'Closest-matching setting on thesession.org — the book’s version may differ',
  sourceNote: 'Bill Black’s transcription of the book, from the Irish Traditional Tune Library',
  footerCopyright: `<em>Ceol Rince na h&Eacute;ireann</em> is in copyright. This independent index is not affiliated
    with the publishers or with thesession.org &mdash; please buy the books for Breathnach&rsquo;s settings and notes.`,
  creditsHtml: `Tune names from Paul de Grae&rsquo;s index at
    <a href="https://nigelgatherer.com/museum/bo/cre/crex.html" target="_blank" rel="noopener">nigelgatherer.com</a>
    &middot; transcriptions of tunes not on thesession from Bill Black&rsquo;s
    <a href="https://www.capeirish.com/ittl/" target="_blank" rel="noopener">Irish Traditional Tune Library</a>
    &middot; notation and links from <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
});
