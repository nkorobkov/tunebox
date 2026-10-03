// Generates the standalone Kerr's Merry Melodies index page:
//   public/kerrs-merry-melodies/index.html     — full static tune list
//   public/kerrs-merry-melodies/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/kerrs-merry-melodies/tunes.json — every tune in James S.
// Kerr's four "Merry Melodies" collections (Glasgow, c. 1880s; public domain) as
// ABC from John Chambers' complete transcription (trillian.mit.edu/~jc/music/
// book/Kerr/, via the Internet Archive), in book order, matched to thesession.org
// (TheSession-data dump) by name and by comparing the opening bars against every
// setting there. Book 1 numbers its tunes per page, so its records carry `page`;
// books 2–4 number tunes through the book (`no`). `match`: 'exact' melody,
// 'name' + partial melody, 'approx' → shown as ≈, 'none'.
// Run manually after updating the data: node scripts/build-kerrs-merry-melodies.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'kerrs-merry-melodies', 'tunes.json'), 'utf8'));
const ordinal = ['', 'First', 'Second', 'Third', 'Fourth'];
const archive = 'https://web.archive.org/web/2024/http://trillian.mit.edu/~jc/music/book/Kerr/';

writeTuneIndexPage({
  root,
  slug: 'kerrs-merry-melodies',
  generator: 'scripts/build-kerrs-merry-melodies.mjs',
  tunes,
  ordered: true, // records are in book order
  books: [1, 2, 3, 4].map((n) => ({ value: n, label: `${ordinal[n]} Collection` })),
  bookChip: (t) => (t.page ? `Book ${t.book} · p. ${t.page}` : `Book ${t.book} · No. ${t.no}`),
  siteTitle: 'Kerr&rsquo;s Merry Melodies &middot; Tune index',
  title: (s) => `Kerr's Merry Melodies tune index — all ${s.total} tunes from books 1–4, with sheet music`,
  ogTitle: (s) => `Kerr's Merry Melodies — all ${s.total} tunes, searchable, with sheet music`,
  description: (s) => `A free searchable index of all ${s.total} tunes in James S. Kerr's four Collections of Merry Melodies for the violin — Scotch and Irish reels, strathspeys, jigs, hornpipes, schottisches and more — with the book's own sheet music and playback for every tune and links to the ${s.linked} found on thesession.org.`,
  jsonLdName: "Kerr's Merry Melodies tune index",
  about: {
    '@type': 'BookSeries',
    name: "Kerr's Collection of Merry Melodies",
    publisher: { '@type': 'Organization', name: 'James S. Kerr, Glasgow' },
  },
  h1: 'Kerr&rsquo;s Merry Melodies <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable index of all ${s.total} tunes in James S. Kerr&rsquo;s four <em>Collections of
      Merry Melodies for the Violin</em> (Glasgow, c.&nbsp;1880s) &mdash; Scotch and Irish reels, strathspeys, jigs,
      hornpipes, schottisches, country dances and waltzes, still a staple of Scottish and Irish fiddlers. Filter by
      book, sort by book order to browse the sets as printed, and open any tune for Kerr&rsquo;s own setting with
      playback.</p>
      <p>${s.linked} tunes link to their page on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, where many go by other
      names &mdash; those are shown under the title.</p>`,
  buyHtml: `<h2>The books</h2>
      <a href="https://imslp.org/wiki/Kerr's_Collection_of_Merry_Melodies_(Various)" target="_blank" rel="noopener">Scans (IMSLP)</a>
      <a href="${archive}" target="_blank" rel="noopener">ABC transcriptions</a>`,
  promoHeading: 'Learning tunes from Kerr&rsquo;s?',
  notationNote: 'Kerr’s own setting, from the book — session versions often differ',
  statsHtml: (s) => `${s.total} tunes &middot; ${s.linked} matched on thesession.org &middot; sheet music &amp; playback for every tune`,
  creditsHtml: `Notation transcribed from the books by
    <a href="${archive}" target="_blank" rel="noopener">John Chambers</a>
    &middot; links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
  footerCopyright: `Kerr&rsquo;s <em>Merry Melodies</em> collections are in the public domain.
    This is an independent index, not affiliated with thesession.org.`,
});
