// Generates the standalone O'Neill's 1001 index page:
//   public/oneills-1001/index.html     — full static tune list
//   public/oneills-1001/tunes-abc.json — id → ABC notation, fetched lazily
//
// Source data: scripts/oneills-1001/tunes.json — every tune of Francis
// O'Neill's "The Dance Music of Ireland: 1001 Gems" (1907, public domain) as
// note-for-note ABC from github.com/folkies/oneill, matched to thesession.org
// (tunes + aliases from the TheSession-data dump) by name and by comparing the
// opening bars of the melody against every setting there. `url` points at the
// closest-matching setting; `match` records how the link was chosen
// ('exact' melody, 'name' + partial melody, 'approx' → shown as ≈, 'none').
// Unlike the other index pages, the notation shown is the book's own.
// Run manually after updating the data: node scripts/build-oneills-1001.mjs
// Page template + behaviour are shared with the other tune-index pages:
// see scripts/lib/tune-index-page.mjs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeTuneIndexPage } from './lib/tune-index-page.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tunes = JSON.parse(readFileSync(join(root, 'scripts', 'oneills-1001', 'tunes.json'), 'utf8'));

writeTuneIndexPage({
  root,
  slug: 'oneills-1001',
  generator: 'scripts/build-oneills-1001.mjs',
  tunes,
  ordered: true, // records are in book order
  bookChip: (t) => `No. ${t.no}`,
  siteTitle: 'O&rsquo;Neill&rsquo;s 1001 &middot; Tune index',
  title: (s) => `O'Neill's 1001 tune index — all ${s.total} tunes from The Dance Music of Ireland`,
  ogTitle: (s) => `O'Neill's 1001 — all ${s.total} tunes, searchable, with sheet music`,
  description: (s) => `A free searchable index of all ${s.total} tunes in Francis O'Neill's The Dance Music of Ireland: 1001 Gems (1907), with the book's own sheet music and audio playback for every tune and links to the ${s.linked} found on thesession.org.`,
  jsonLdName: "O'Neill's 1001 tune index",
  about: {
    '@type': 'Book',
    name: 'The Dance Music of Ireland: 1001 Gems',
    alternateName: "O'Neill's 1001",
    author: { '@type': 'Person', name: "Francis O'Neill" },
    datePublished: '1907',
  },
  h1: 'O&rsquo;Neill&rsquo;s 1001 <span class="accent">tune index</span>',
  intro: (s) => `<p>A searchable index of all ${s.total} tunes in Francis O&rsquo;Neill&rsquo;s <em>The Dance Music of
      Ireland: 1001 Gems</em> (Chicago, 1907) &mdash; the double jigs, single and slip jigs, reels, hornpipes and set
      dances that became the backbone of the Irish session repertoire. Search by any of the book&rsquo;s titles, sort
      by number to browse it in order, and open any tune for O&rsquo;Neill&rsquo;s own setting with playback.</p>
      <p>${s.linked} tunes link to their page on
      <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>, where many go by other
      names &mdash; those are shown under the title.</p>`,
  buyHtml: `<h2>The book</h2>
      <a href="https://imslp.org/wiki/The_Dance_Music_of_Ireland_(O'Neill,_Francis)" target="_blank" rel="noopener">Scanned original (IMSLP)</a>
      <a href="https://github.com/folkies/oneill" target="_blank" rel="noopener">ABC transcriptions</a>
      <a href="https://en.wikipedia.org/wiki/Francis_O%27Neill" target="_blank" rel="noopener">About Francis O&rsquo;Neill</a>`,
  promoHeading: 'Learning tunes from O&rsquo;Neill&rsquo;s?',
  notationNote: 'O’Neill’s own setting (1907), from the book — session versions often differ',
  statsHtml: (s) => `${s.total} tunes &middot; ${s.linked} matched on thesession.org &middot; sheet music &amp; playback for every tune`,
  creditsHtml: `Notation transcribed note-for-note from the book by the
    <a href="https://github.com/folkies/oneill" target="_blank" rel="noopener">O&rsquo;Neill&rsquo;s ABC project</a>
    &middot; links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`,
  footerCopyright: `<em>The Dance Music of Ireland: 1001 Gems</em> (1907) by Francis O&rsquo;Neill is in the public domain.
    This is an independent index, not affiliated with thesession.org.`,
});
