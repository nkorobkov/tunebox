/**
 * One-off: recompute every tune's stability under the current scheduling
 * rules by replaying its practice_log, and write the corrected values back.
 *
 * Needed because stability is stored as a running value, not derived — when
 * the rules in src/lib/practice-algorithm.js change, existing records keep
 * whatever the old rules left behind. (The change that prompted this one left
 * well-practised tunes at a stability of 0.15 days, i.e. due every session.)
 *
 * Usage, from the repo root:
 *   node scripts/migrate-stability.mjs              # dry run — prints the diff
 *   node scripts/migrate-stability.mjs --apply      # writes to PocketBase
 *   node scripts/migrate-stability.mjs --user <id>  # limit to one account
 *
 * Credentials come from .env (PB_URL, PB_EMAIL, PB_PASSWORD — superuser).
 * --apply takes a PocketBase backup first; see LOCAL_SETUP.md.
 */

import { readFileSync } from 'node:fs';
import {
  updateStability,
  restDays,
  INITIAL_STABILITY,
} from '../src/lib/practice-algorithm.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// practice_log stores the numeric fluency rating; map it back to the rating
// word (the inverse of the fluencyMap in savePlayingPractice).
const RATING_WORDS = { 5: 'easy', 4: 'good', 3: 'good', 2: 'hard', 1: 'relearn' };

function loadEnv() {
  const env = {};
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function api(base, path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  // Some endpoints (e.g. /api/backups) answer 204 with no body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getAll(base, token, collection, params = {}) {
  const items = [];
  for (let page = 1; page <= 50; page++) {
    const qs = new URLSearchParams({ page: String(page), perPage: '500', ...params });
    const res = await api(base, `/api/collections/${collection}/records?${qs}`, { token });
    items.push(...res.items);
    if (res.items.length < 500) break;
  }
  return items;
}

/**
 * Replay one tune+instrument from its first practice to now.
 *
 * Learning-mode rows (played below target tempo) don't move stability; the
 * ladder starts at INITIAL_STABILITY the first time the tune is played at or
 * above target, which is the moment it becomes a "playing" tune. Everything
 * after that runs through updateStability with the real gap between practices,
 * exactly as the live save path does.
 */
function replay(events, targetTempo) {
  let stability = INITIAL_STABILITY;
  let playing = false;
  let last = null;

  for (const e of events) {
    const rating = RATING_WORDS[e.fluency_rating] || 'good';

    if (!playing) {
      // Graduation: first practice at or above the target tempo.
      if (targetTempo > 0 && e.tempo_used >= targetTempo) {
        playing = true;
        stability = INITIAL_STABILITY;
        last = e.t;
      }
      continue;
    }

    if (rating === 'relearn') {
      // Back to learning; the next graduation restarts the ladder.
      stability = INITIAL_STABILITY;
      playing = false;
      last = null;
      continue;
    }

    stability = updateStability(stability, rating, last ? (e.t - last) / DAY_MS : 0);
    last = e.t;
  }

  return { stability, playing };
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyUser = args[args.indexOf('--user') + 1];

const env = loadEnv();
const base = (env.PB_URL || 'https://pb.home.nkorobkov.com').replace(/\/$/, '');

const auth = await api(base, '/api/collections/_superusers/auth-with-password', {
  method: 'POST',
  body: { identity: env.PB_EMAIL, password: env.PB_PASSWORD },
});
const token = auth.token;
console.log(`authenticated as superuser on ${base}`);

if (apply) {
  // Minute-stamped so a re-run doesn't collide with an existing backup.
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const name = `pre-stability-migration-${stamp}.zip`;
  await api(base, '/api/backups', { token, method: 'POST', body: { name } });
  console.log(`backup created: ${name}`);
}

const filter = onlyUser && args.includes('--user') ? { filter: `user = "${onlyUser}"` } : {};
const tunes = await getAll(base, token, 'user_tunes', filter);
const logs = await getAll(base, token, 'practice_log', filter);
console.log(`${tunes.length} tunes, ${logs.length} practice rows\n`);

// Practices grouped per tune+instrument, oldest first.
const byPair = new Map();
for (const log of logs) {
  const t = Date.parse(log.practiced_at);
  if (isNaN(t)) continue;
  const key = `${log.user_tune}|${log.instrument || ''}`;
  if (!byPair.has(key)) byPair.set(key, []);
  byPair.get(key).push({ t, tempo_used: log.tempo_used || 0, fluency_rating: log.fluency_rating });
}
for (const events of byPair.values()) events.sort((a, b) => a.t - b.t);

const changes = [];
for (const tune of tunes) {
  const instruments = tune.instruments || {};
  let next = null;

  for (const [name, data] of Object.entries(instruments)) {
    const isPlaying = data.target_tempo > 0 && data.current_tempo >= data.target_tempo;
    if (!isPlaying) continue; // learning tunes are due daily; stability is unused

    const events = byPair.get(`${tune.id}|${name}`) || [];
    const { stability, playing } = replay(events, data.target_tempo);
    // A tune whose log never shows a practice at target tempo (progress typed
    // in by hand, or history older than the log) gets the first rung rather
    // than a number the replay can't justify.
    const value = playing ? stability : INITIAL_STABILITY;
    const before = data.stability ?? INITIAL_STABILITY;
    if (Math.abs(value - before) < 0.005) continue;

    next = next || { ...instruments };
    next[name] = { ...data, stability: value };
    changes.push({
      id: tune.id, title: tune.title, instrument: name,
      before, after: value, events: events.length,
    });
  }

  if (next) tune.__next = next;
}

changes.sort((a, b) => a.before - b.before);
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
console.log(`${pad('tune', 26)}${pad('instrument', 12)}${'S before'.padStart(9)}${'rest'.padStart(8)}   ${'S after'.padStart(8)}${'rest'.padStart(8)}`);
for (const c of changes) {
  console.log(
    `${pad(c.title, 26)}${pad(c.instrument, 12)}` +
    `${c.before.toFixed(2).padStart(9)}${(restDays(c.before).toFixed(1) + 'd').padStart(8)}   ` +
    `${c.after.toFixed(2).padStart(8)}${(restDays(c.after).toFixed(1) + 'd').padStart(8)}`,
  );
}
console.log(`\n${changes.length} instrument entries would change`);

if (!apply) {
  console.log('\ndry run — re-run with --apply to write these values');
  process.exit(0);
}

let written = 0;
for (const tune of tunes) {
  if (!tune.__next) continue;
  await api(base, `/api/collections/user_tunes/records/${tune.id}`, {
    token, method: 'PATCH', body: { instruments: tune.__next },
  });
  written++;
}
console.log(`\nwrote ${written} tune records`);
