// Shared generator for the standalone tune-index pages (Portland Collection,
// Foinn Seisiún, …). Each page is one static HTML file listing every tune
// (SEO: every name is in the HTML) plus a tunes-abc.json payload (card id →
// ABC) fetched lazily on the first "Sheet music" click. Behaviour lives in
// public/tune-index/app.js (hand-written, shared by all pages); abcjs is
// lazy-loaded from /abcjs/ (copied out of node_modules by
// copy-vendor-assets.mjs on postinstall).
//
// The app links here only via the add-tune page's "Browse collections"; these
// are otherwise standalone SEO / traffic pages that link out to tunebox.net.
//
// Tune records: { book, name, type?, url?, abc?, settings?, closest?,
//                 page?, sessionName?, altNames?, source? }
// `page` enables the page chip and the book-order sort; `sessionName` (the
// tune's name on thesession.org, when the book calls it something else) is
// shown on the card and included in search, as are `altNames` (the book's
// own alternative titles). `source` ({url, label}) is where a tune that isn't
// on thesession takes its notation from; the card links there instead.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The "+" buttons (app.js) write straight to the app's PocketBase with the
// visitor's TuneBox session (same origin, so the SDK's localStorage entry).
const PB_URL = 'https://pb.home.nkorobkov.com';

// Shared page styles (also used by the /collections/ hub, scripts/build-collections.mjs).
export const BASE_CSS = `  :root {
    --gray-50:#f9fafb; --gray-100:#f3f4f6; --gray-200:#e5e7eb; --gray-300:#d1d5dc;
    --gray-400:#99a1af; --gray-500:#6a7282; --gray-600:#4a5565; --gray-700:#364153;
    --gray-900:#101828;
    --brand-50:#f2faf1; --brand-100:#e2f3e0; --brand-200:#c4e8c0; --brand-600:#389833;
    --brand-700:#2c7a28; --brand-800:#25631f;
    --amber-50:#fffbeb; --amber-200:#fee685; --amber-800:#973c00;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; background:var(--gray-50); color:var(--gray-900);
    font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  }
  a { color:var(--brand-700); }
  .wrap { max-width:56rem; margin:0 auto; padding:0 1rem; }

  header.site {
    position:sticky; top:0; z-index:20; background:rgba(249,250,251,.85);
    backdrop-filter:blur(8px); border-bottom:1px solid var(--gray-200);
  }
  header.site .wrap { height:3.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .site-title { font-weight:600; font-size:.95rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .site-title .crumb { font-weight:500; color:var(--gray-500); text-decoration:none; }
  .site-title .crumb:hover { color:var(--brand-700); text-decoration:underline; }
  .site-title .crumb-sep { color:var(--gray-400); margin:0 .35rem; font-weight:400; }
  .site-brand { display:flex; align-items:center; gap:.5rem; font-size:.8rem; color:var(--gray-500); text-decoration:none; white-space:nowrap; }
  .site-brand:hover { color:var(--gray-700); }
  .site-brand img { height:1.5rem; display:block; }

  .hero { padding:2.5rem 0 1.5rem; display:flex; flex-wrap:wrap; gap:1.5rem 3rem; align-items:flex-start; }
  .hero-intro { flex:1 1 26rem; min-width:0; }
  h1 { margin:0 0 .75rem; font-size:2rem; line-height:1.15; font-weight:700; letter-spacing:-.02em; }
  h1 .accent { color:var(--brand-600); }
  .hero p { margin:.5rem 0 0; color:var(--gray-600); }

  .buy { flex:0 0 auto; font-size:.85rem; }
  .buy h2 { margin:0 0 .35rem; font-size:.75rem; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--gray-500); }
  .buy a { display:block; margin:.3rem 0; color:var(--brand-700); }

  .controls {
    position:sticky; top:3.5rem; z-index:10; background:var(--gray-50);
    padding:.75rem 0; border-bottom:1px solid var(--gray-200);
    display:flex; flex-wrap:wrap; gap:.5rem; align-items:center;
  }
  .controls input[type=search], .controls select {
    font:inherit; font-size:.9rem; padding:.5rem .65rem; color:var(--gray-900);
    border:1px solid var(--gray-300); border-radius:.5rem; background:#fff;
  }
  .controls input[type=search] { flex:1 1 14rem; min-width:11rem; }
  .controls :focus-visible { outline:2px solid var(--brand-600); outline-offset:1px; }
  .count { margin-left:auto; color:var(--gray-500); font-size:.8rem; white-space:nowrap; }

  .list { display:flex; flex-direction:column; gap:.4rem; margin:.75rem 0 2rem; }
  .tune { background:#fff; border:1px solid var(--gray-200); border-radius:.75rem; }
  .tune-head { display:flex; align-items:center; flex-wrap:wrap; gap:.4rem; padding:.6rem .85rem; border-radius:.75rem; }
  .tune[data-a="1"] .tune-head { cursor:pointer; }
  .tune[data-a="1"] .tune-head:hover { background:var(--gray-50); }
  .tune[data-a="1"] .tune-head:focus-visible { outline:2px solid var(--brand-600); outline-offset:-2px; }
  .tune-name { font-weight:600; flex:1 1 auto; min-width:10rem; }
  .tune-aka { display:block; font-weight:400; font-size:.75rem; color:var(--gray-500); }
  .caret { color:var(--gray-400); font-size:.8rem; transition:transform .15s; }
  .tune.open .caret { transform:rotate(180deg); }
  .tune.open .tune-head { border-radius:.75rem .75rem 0 0; }
  .btn-session {
    font-size:.8rem; font-weight:500; white-space:nowrap; text-decoration:none;
    padding:.35rem .8rem; border:1px solid var(--gray-300); border-radius:.5rem;
    background:#fff; color:var(--gray-700);
  }
  .btn-session:hover { border-color:var(--brand-600); color:var(--brand-700); }
  .chip {
    font-size:.72rem; padding:.1rem .55rem; border-radius:9999px;
    background:var(--gray-100); color:var(--gray-600); white-space:nowrap;
  }
  .chip-book { background:var(--brand-100); color:var(--brand-800); }
  .chip-approx { background:var(--amber-50); color:var(--amber-800); border:1px solid var(--amber-200); }
  .chip-na { background:none; border:1px dashed var(--gray-300); color:var(--gray-400); }
  .tune-detail { border-top:1px solid var(--gray-200); padding:.85rem; }
  .tune-detail .meta { color:var(--gray-500); font-size:.75rem; margin:0 0 .5rem; }
  .score { overflow-x:auto; background:#fff; color:#000; }
  .abcjs-inline-audio { margin-top:.6rem; border-radius:.5rem; }
  .empty { text-align:center; color:var(--gray-500); padding:2.5rem 0; display:none; }

  .promo {
    background:var(--brand-50); border:1px solid var(--brand-200); border-radius:.75rem;
    padding:1.5rem; margin:2.5rem 0 1rem; text-align:center;
  }
  .promo h2 { margin:0 0 .5rem; font-size:1.3rem; letter-spacing:-.01em; }
  .promo p { margin:0 auto; color:var(--gray-600); max-width:36rem; }
  .promo .cta {
    display:inline-block; margin-top:1rem; padding:.6rem 1.4rem; border-radius:.5rem;
    background:var(--brand-600); color:#fff; text-decoration:none; font-weight:500; font-size:.9rem;
  }
  .promo .cta:hover { background:var(--brand-700); }

  .add-wrap { position:relative; flex:0 0 auto; }
  .btn-add {
    font:inherit; font-size:1.1rem; line-height:1; width:2rem; height:2rem; padding:0; cursor:pointer;
    border:1px solid var(--gray-300); border-radius:.5rem; background:#fff; color:var(--brand-700);
  }
  .btn-add:hover { border-color:var(--brand-600); background:var(--brand-50); }
  .btn-add:focus-visible { outline:2px solid var(--brand-600); outline-offset:1px; }
  .btn-add.added { background:var(--brand-600); border-color:var(--brand-600); color:#fff; font-size:.9rem; }
  .add-pop {
    position:absolute; right:0; top:calc(100% + .4rem); z-index:30; width:max-content; max-width:16rem;
    background:#fff; border:1px solid var(--gray-200); border-radius:.6rem; padding:.6rem .7rem;
    box-shadow:0 8px 24px rgba(16,24,40,.14); font-size:.82rem; color:var(--gray-700); cursor:default;
  }
  .add-pop p { margin:0 0 .5rem; }
  .add-pop p:last-child { margin-bottom:0; }
  .add-pop .actions { display:flex; gap:.4rem; justify-content:flex-end; }
  .btn {
    font:inherit; font-size:.82rem; font-weight:500; padding:.35rem .8rem; border-radius:.45rem; cursor:pointer;
    border:1px solid var(--gray-300); background:#fff; color:var(--gray-700); text-decoration:none; display:inline-block;
  }
  .btn:hover { background:var(--gray-50); }
  .btn-primary { background:var(--brand-600); border-color:var(--brand-600); color:#fff; }
  .btn-primary:hover { background:var(--brand-700); }
  .btn:disabled { opacity:.6; cursor:default; }
  .add-error { color:#b42318; }

  dialog.signin {
    border:none; border-radius:1rem; padding:1.75rem 1.5rem 1.5rem; width:min(26rem, calc(100vw - 2rem));
    box-shadow:0 24px 64px rgba(16,24,40,.25); color:var(--gray-900); text-align:center;
  }
  dialog.signin::backdrop { background:rgba(16,24,40,.45); }
  dialog.signin .close {
    position:absolute; top:.6rem; right:.6rem; width:2rem; height:2rem; border:none; background:none;
    font-size:1.3rem; line-height:1; color:var(--gray-400); cursor:pointer; border-radius:.4rem;
  }
  dialog.signin .close:hover { color:var(--gray-700); background:var(--gray-100); }
  dialog.signin img { height:2rem; margin-bottom:.75rem; }
  dialog.signin h2 { margin:0 0 .5rem; font-size:1.2rem; letter-spacing:-.01em; }
  dialog.signin p { margin:0 0 1rem; color:var(--gray-600); font-size:.9rem; }
  dialog.signin .btn { font-size:.95rem; padding:.65rem 1rem; width:100%; }

  footer.site { color:var(--gray-500); font-size:.78rem; text-align:center; padding:0 0 2.5rem; }
  footer.site p { margin:.35rem 0; }
`;

export const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Loose comparison so "The Teetotaller" vs "Teetotaller" doesn't count as a different name.
const looseName = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(the|reel|jig|slip jig|polka|slide|hornpipe|mazurka|waltz|march)\b/g, '').replace(/[^a-z0-9]/g, '');

/**
 * @param {object} c
 * @param {string} c.root          repo root
 * @param {string} c.slug          URL path segment, e.g. 'portland-collection'
 * @param {string} c.generator     script path, for the "do not edit" comment
 * @param {object[]} c.tunes       tune records (see above)
 * @param {{value:number,label:string}[]} [c.books]  book filter options (omit for a single book)
 * @param {(t:object)=>string} [c.bookChip]       chip text for a tune (omit for an unnumbered book)
 * @param {string} c.siteTitle     header bar text (HTML)
 * @param {(s:object)=>string} c.title            <title>
 * @param {(s:object)=>string} c.ogTitle
 * @param {(s:object)=>string} c.description      meta description (plain text)
 * @param {string} c.h1            h1 inner HTML
 * @param {(s:object)=>string} c.intro            hero paragraph(s) HTML
 * @param {string} c.buyHtml       aside inner HTML
 * @param {object} c.about         JSON-LD "about" object
 * @param {string} c.promoHeading
 * @param {string} c.footerCopyright   footer paragraph inner HTML
 * @param {boolean} [c.availFilter=true] show the availability filter
 * @param {boolean} [c.ordered]   enable the book-order sort (default: tunes have `page`)
 * @param {string} [c.notationNote]  caption above each score (default: thesession disclaimer)
 * @param {string} [c.sourceNote]    caption above scores taken from a tune's `source`
 * @param {string} [c.creditsHtml]   footer credits line (default: thesession notation credit)
 * @param {string} [c.statsHtml]     footer stats line (default: totals vs thesession)
 */
export function writeTuneIndexPage(c) {
  const outDir = join(c.root, 'public', c.slug);
  mkdirSync(outDir, { recursive: true });
  const base = `https://tunebox.net/${c.slug}/`;

  // Stable ids follow source-data order (data-o keeps it for the book-order
  // sort); cards are emitted alphabetically.
  const withIds = c.tunes.map((t, i) => ({ ...t, _id: 't' + i, _o: i }));
  // Name sort ignores a leading article, as thesession does ("The Kesh" under K).
  const sortKey = (n) => n.replace(/^(the|an|a)\s+/i, '');
  const sorted = [...withIds].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)));

  const total = c.tunes.length;
  const linked = c.tunes.filter((t) => t.url).length;
  const playable = c.tunes.filter((t) => t.abc).length;
  const types = [...new Set(c.tunes.map((t) => t.type).filter(Boolean))].sort();
  const stats = { total, linked, playable };
  const hasPages = c.ordered ?? c.tunes.some((t) => t.page);

  // ---- ABC payload (lazy-fetched) ----
  const abcMap = {};
  for (const t of withIds) if (t.abc) abcMap[t._id] = t.abc;
  writeFileSync(join(outDir, 'tunes-abc.json'), JSON.stringify(abcMap));

  // ---- tune cards ----
  // Row click (JS) expands the score; the side button links to thesession.org.
  const cards = sorted.map((t) => {
    const aka = t.sessionName && looseName(t.sessionName) !== looseName(t.name) ? t.sessionName : '';
    const alt = (t.altNames || []).join(' / ');
    const chips = [
      c.bookChip ? `<span class="chip chip-book">${esc(c.bookChip(t))}</span>` : '',
      t.type ? `<span class="chip">${esc(cap(t.type))}</span>` : '',
      t.closest ? `<span class="chip chip-approx" title="Approximate match on thesession.org — may differ from the book&#39;s version">&asymp; match</span>` : '',
      !t.url ? `<span class="chip chip-na">Not on thesession</span>` : '',
    ].filter(Boolean).join('');
    const caret = t.abc ? `<span class="caret" aria-hidden="true">&#9662;</span>` : '';
    const sessionBtn = t.url
      ? `<a class="btn-session" href="${esc(t.url)}" target="_blank" rel="noopener">thesession &#8599;</a>`
      : t.source
        ? `<a class="btn-session" href="${esc(t.source.url)}" target="_blank" rel="noopener">${esc(t.source.label)} &#8599;</a>`
        : '';
    const akaHtml = (alt ? `<span class="tune-aka">also: ${esc(alt)}</span>` : '') +
      (aka ? `<span class="tune-aka">thesession: ${esc(aka)}</span>` : '');
    const nameHtml = `<span class="tune-name">${esc(t.name)}${akaHtml}</span>`;
    const attrs = [
      `data-id="${t._id}"`,
      `data-n="${esc(t.name.toLowerCase())}"`,
      aka || alt ? `data-s="${esc([aka, alt].filter(Boolean).join(' ').toLowerCase())}"` : '',
      `data-b="${t.book}"`,
      hasPages ? `data-o="${t._o}"` : '',
      `data-t="${esc(t.type || '')}"`,
      `data-a="${t.abc ? 1 : 0}"`,
      `data-l="${t.url ? 1 : 0}"`,
      t.settings > 1 ? `data-settings="${t.settings}"` : '',
      t.source && c.sourceNote ? `data-note="${esc(c.sourceNote)}"` : '',
    ].filter(Boolean).join(' ');
    return `<article class="tune" ${attrs}>
<div class="tune-head">${nameHtml}${chips}${caret}${sessionBtn}</div>
<div class="tune-detail" hidden></div>
</article>`;
  }).join('\n');

  const typeOptions = types.map((t) => `<option value="${esc(t)}">${esc(cap(t))}</option>`).join('');
  const bookOptions = (c.books || []).map((b) => `<option value="${b.value}">${esc(b.label)}</option>`).join('');
  const description = c.description(stats);

  const availSelect = c.availFilter === false ? '' : `
    <select id="avail" aria-label="Filter by availability">
      <option value="">All tunes</option>
      <option value="abc">With sheet music</option>
      <option value="link">On thesession.org</option>
      <option value="na">Not on thesession.org</option>
    </select>`;

  const html = `<!doctype html>
<!-- GENERATED by ${c.generator} — do not edit by hand. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; connect-src 'self' ${PB_URL} https://tunebox.goatcounter.com; img-src 'self' data: https://tunebox.goatcounter.com; media-src 'self' blob:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'">
<title>${esc(c.title(stats))}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${base}">
<link rel="icon" type="image/svg+xml" href="/tunebook-logo.svg">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TuneBox">
<meta property="og:url" content="${base}">
<meta property="og:title" content="${esc(c.ogTitle(stats))}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="https://tunebox.net/og-image.png">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: c.jsonLdName,
    url: base,
    description,
    isPartOf: { '@type': 'WebSite', name: 'TuneBox', url: 'https://tunebox.net/' },
    about: c.about,
  }, null, 2)}
</script>
<script data-goatcounter="https://tunebox.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
<link rel="stylesheet" href="/abcjs/abcjs-audio.css">
<style>
${BASE_CSS}</style>
</head>
<body>
<header class="site">
  <div class="wrap">
    <span class="site-title"><a class="crumb" href="/collections/">Collections</a><span class="crumb-sep" aria-hidden="true">&rsaquo;</span>${c.siteTitle}</span>
    <a class="site-brand" href="https://tunebox.net/">hosted by <img src="/tunebook.svg" alt="TuneBox"></a>
  </div>
</header>

<div class="wrap">
  <section class="hero">
    <div class="hero-intro">
      <h1>${c.h1}</h1>
      ${c.intro(stats)}
    </div>
    <aside class="buy">
      ${c.buyHtml}
    </aside>
  </section>

  <div class="controls" id="controls" hidden>
    <input id="q" type="search" placeholder="Search ${total} tunes&hellip;" autocomplete="off" aria-label="Search tunes by name">
    ${c.books ? `<select id="book" aria-label="Filter by book">
      <option value="">All books</option>${bookOptions}
    </select>` : ''}
    <select id="type" aria-label="Filter by tune type">
      <option value="">All types</option>${typeOptions}
    </select>${availSelect}
    <select id="sort" aria-label="Sort order">
      <option value="name">Sort: name</option>
      ${hasPages || c.books ? `<option value="book">${hasPages ? 'Sort: book order' : 'Sort: book'}</option>` : ''}
      <option value="type">Sort: type</option>
    </select>
    <span class="count" id="count"></span>
  </div>

  <main class="list" id="list" data-abc="/${c.slug}/tunes-abc.json" data-pb="${PB_URL}"${c.notationNote ? ` data-note="${esc(c.notationNote)}"` : ''}>
${cards}
  </main>
  <div class="empty" id="empty">No tunes match your filters.</div>

  <section class="promo">
    <h2>${c.promoHeading}</h2>
    <p><a href="https://tunebox.net/">TuneBox</a> is a free digital tunebook and practice planner for traditional
    musicians. Add any of these tunes to your tunebook with the + button, keep your repertoire organized
    per instrument, and let spaced repetition decide what to practice tonight.</p>
    <a class="cta" href="https://tunebox.net/">Open TuneBox &mdash; it&rsquo;s free</a>
  </section>

  <footer class="site">
    <p>${c.statsHtml ? c.statsHtml(stats) : `${total} tunes &middot; ${linked} matched on thesession.org &middot; ${playable} with sheet music &amp; playback`}</p>
    <p>${c.footerCopyright}</p>
    <p>${c.creditsHtml || `Notation and links from the community archive <a href="https://thesession.org" target="_blank" rel="noopener">thesession.org</a>`}
    &middot; rendering &amp; playback by <a href="https://www.abcjs.net/" target="_blank" rel="noopener">abcjs</a>
    &middot; page by <a href="https://tunebox.net/">TuneBox</a>.</p>
    <p><a href="/collections/">More tune collections</a></p>
  </footer>
</div>

<script src="/tune-index/app.js" defer></script>
</body>
</html>
`;

  writeFileSync(join(outDir, 'index.html'), html);
  console.log(`${c.slug}: wrote index.html (${(html.length / 1024).toFixed(0)} KB, ${total} tunes) and tunes-abc.json (${playable} tunes with ABC)`);
}
