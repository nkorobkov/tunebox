import { pb } from './pb';
import { buildAbcString, getMeter } from './abc-utils';
import { getFileUrl } from '../hooks/use-attachments';
import { instrumentProficiency } from './practice-algorithm';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function datedFilename(base, ext) {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export function buildTitleList(tunes) {
  return tunes.map(t => t.title).join('\n') + '\n';
}

/**
 * Human-readable lines describing what Tunebox knows about a tune —
 * used as ABC comments when the tune has no notation.
 */
export function describeTuneData(tune) {
  const lines = [];
  const meta = [tune.type, tune.setting_key && `key ${tune.setting_key}`].filter(Boolean).join(', ');
  if (meta) lines.push(meta);
  for (const name of Object.keys(tune.instruments || {})) {
    const data = tune.instruments[name];
    const prof = instrumentProficiency(tune, name);
    const tempo = prof === 'learning' && data.target_tempo > 0
      ? ` (${data.current_tempo || 0}/${data.target_tempo} BPM)`
      : '';
    lines.push(`${prof} on ${name}${tempo}`);
  }
  const source = tune.session_url || tune.source_url ||
    (tune.session_id > 0 ? `https://thesession.org/tunes/${tune.session_id}` : null);
  if (source) lines.push(`Source: ${source}`);
  if (tune.notes) lines.push(...tune.notes.split('\n').map(l => `Note: ${l}`));
  return lines;
}

function placeholderAbc(tune, index) {
  const header = [`X:${index}`, `T:${tune.title}`];
  if (tune.type) header.push(`R:${tune.type}`);
  header.push(`M:${getMeter(tune.type)}`, 'L:1/8', `K:${tune.setting_key || 'C'}`);
  return [
    ...header,
    '% No ABC notation stored in Tunebox for this tune.',
    ...describeTuneData(tune).map(l => `% ${l}`),
  ].join('\n');
}

/** Full ABC for one tune (placeholder if it has none), renumbered to the given X index. */
export function fullTuneAbc(tune, index = 1) {
  if (!tune.abc) return placeholderAbc(tune, index);
  const abc = buildAbcString(tune.title, tune.type, tune.setting_key, tune.abc);
  return abc.replace(/^X:\s*\d*/m, `X:${index}`);
}

export function buildTunebookTxt(tunes) {
  return tunes.map((t, i) => fullTuneAbc(t, i + 1).trim()).join('\n\n') + '\n';
}

async function fetchPracticeLogs(tuneId) {
  const all = [];
  let page = 1;
  while (page <= 20) {
    const res = await pb.collection('practice_log').getList(page, 500, {
      filter: `user_tune = "${tuneId}"`,
      sort: 'practiced_at',
    });
    all.push(...res.items);
    if (res.items.length < 500) break;
    page++;
  }
  return all;
}

function logsToCsv(logs) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = logs.map(l =>
    [l.practiced_at, l.instrument, l.tempo_used, l.fluency_rating].map(esc).join(',')
  );
  return ['practiced_at,instrument,tempo_used,fluency_rating', ...rows].join('\n') + '\n';
}

function folderName(title, used) {
  const base = title.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'tune';
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) name = `${base} (${n++})`;
  used.add(name.toLowerCase());
  return name;
}

/**
 * Build a ZIP with a folder per tune: ABC, full record JSON,
 * practice history CSV, and all attachment files.
 */
export async function buildArchive(tunes, onProgress) {
  const { zip } = await import('fflate');
  const enc = new TextEncoder();
  const files = {};
  const used = new Set();

  for (const [i, tune] of tunes.entries()) {
    onProgress?.(`Packing ${i + 1}/${tunes.length}: ${tune.title}`);
    const folder = folderName(tune.title, used);
    files[`${folder}/tune.abc`] = enc.encode(fullTuneAbc(tune) + '\n');
    files[`${folder}/tune.json`] = enc.encode(JSON.stringify(tune, null, 2) + '\n');

    const logs = await fetchPracticeLogs(tune.id);
    if (logs.length) {
      files[`${folder}/practice-history.csv`] = enc.encode(logsToCsv(logs));
    }

    const atts = await pb.collection('attachments').getList(1, 100, {
      filter: `user_tune = "${tune.id}"`,
    });
    for (const att of atts.items) {
      try {
        const res = await fetch(getFileUrl(att));
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        // Attachments are mostly audio/images — already compressed, store as-is.
        files[`${folder}/attachments/${att.file}`] = [buf, { level: 0 }];
      } catch (err) {
        console.warn(`Skipping attachment ${att.file}:`, err);
      }
    }
  }

  onProgress?.('Compressing archive...');
  const data = await new Promise((resolve, reject) =>
    zip(files, { level: 6 }, (err, d) => (err ? reject(err) : resolve(d)))
  );
  return new Blob([data], { type: 'application/zip' });
}
