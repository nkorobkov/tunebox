// Snapshot thesession.org's most popular tunes (by tunebook count) into
// src/data/popular-tunes.json for the add-tune page's search tab, which lists
// and filters them locally before falling back to a full archive search.
// Compact rows: [id, name, type]. Regenerate occasionally and commit:
//   node scripts/fetch-popular-tunes.mjs [count]
import { writeFile } from 'node:fs/promises';

const COUNT = Number(process.argv[2]) || 500;
const PER_PAGE = 50;
const rows = [];
for (let page = 1; rows.length < COUNT; page++) {
  const res = await fetch(`https://thesession.org/tunes/popular?format=json&perpage=${PER_PAGE}&page=${page}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  const data = await res.json();
  if (!data.tunes?.length) break;
  for (const t of data.tunes) rows.push([t.id, t.name, t.type]);
  await new Promise(r => setTimeout(r, 300));
}
const out = rows.slice(0, COUNT);
await writeFile(new URL('../src/data/popular-tunes.json', import.meta.url),
  '[\n' + out.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
console.log(`Wrote ${out.length} tunes`);
