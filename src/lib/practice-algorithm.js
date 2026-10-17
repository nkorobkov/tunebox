/**
 * Practice scheduling: when a tune comes back, and how far it moves each time.
 * The reasoning behind the constants, and how to change them safely, is in
 * PRACTICE_ALGORITHM.md — read that before touching the numbers here.
 *
 * Each tune's instrument entry stores:
 *   stability      — how long it holds (days); higher = more resistant to forgetting
 *   last_practiced — ISO date string of last practice
 *   current_tempo  — BPM the user can reliably play at
 *   target_tempo   — goal BPM
 *
 * forgettingRisk = 1 - exp(-t / S)
 *   where t = days since last practice, S = stability
 * A playing tune is due once that risk reaches DUE_RISK_THRESHOLD, i.e. after
 * restDays(S) = 0.69 * S days; learning tunes are due every day.
 *
 * Priority formula (orders the tunes that are due):
 *   priority = W1 * (target - current) + W2 * forgettingRisk
 *   priority += sigmoid(forgettingRisk - 0.7) * BOOST
 */

const W1 = 0.01;
const W2 = 10;
const BOOST = 5;
const INITIAL_STABILITY = 1.0;
const RELEARN_TEMPO_FACTOR = 0.8;

// Stability is measured in days and bounded at both ends: never below a day
// (a tune you can play is never a two-hour tune) and never beyond half a year
// (anything you haven't touched in that long is worth a look regardless).
const MIN_STABILITY = 1.0;
const MAX_STABILITY = 180;

// Growth per successful review, reached only when the review happens on or
// after its due date; see updateStability for the early-review damping.
const STABILITY_GAIN = {
  easy: 2,
  good: 1.4,
};
const HARD_FACTOR = 0.75;

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

export function forgettingRisk(daysSincePractice, stability) {
  if (!stability || stability <= 0) return 1;
  return 1 - Math.exp(-daysSincePractice / stability);
}

export function daysSince(dateStr) {
  if (!dateStr) return 30; // never practiced → treat as 30 days
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get instrument data for a tune, falling back to defaults.
 * @param {object} tune - user_tune record
 * @param {string} instrument - instrument name
 * @param {number} fallbackTempo - from canonical_tempo or type default
 */
export function getInstrumentData(tune, instrument, fallbackTempo) {
  const data = tune.instruments?.[instrument];
  return {
    current_tempo: data?.current_tempo || 0,
    target_tempo: data?.target_tempo || fallbackTempo,
    stability: data?.stability ?? INITIAL_STABILITY,
    last_practiced: data?.last_practiced || null,
    keys: data?.keys || [],
  };
}

/**
 * Calculate practice priority for a tune on a given instrument.
 */
export function calculatePriority(tune, instrument, fallbackTempo) {
  const d = getInstrumentData(tune, instrument, fallbackTempo);
  const t = daysSince(d.last_practiced);
  const fr = forgettingRisk(t, d.stability);
  const bpmGap = Math.max(0, d.target_tempo - d.current_tempo);

  let priority = W1 * bpmGap + W2 * fr;
  priority += sigmoid(fr - 0.7) * BOOST;
  return priority;
}

/**
 * Update stability after a playing-mode rating.
 *
 * A success multiplies stability, but only in proportion to how much of the
 * scheduled rest was actually used:
 *
 *   dueness = min(1, elapsed / restDays(S))     1 = played on or after its due day
 *   S' = S * (1 + (gain - 1) * dueness)
 *
 * so playing a tune the day after you last played it earns a sliver of the
 * growth, and playing it on schedule earns all of it. The cap at 1 means
 * neglect is never worth *more* than discipline: a tune left for three months
 * and then played well lands exactly where an on-time success would have put
 * it. (Anki and FSRS both pay a bonus there; we deliberately don't — under-
 * resting a tune you still know is a cheaper mistake than over-resting one
 * you've quietly lost.)
 *
 * `hard` is a pass you struggled through: it shrinks stability from where it
 * was, ignoring elapsed time, so the tune comes back sooner than the gap you
 * just survived. `relearn` is the fail button and is handled by the caller
 * (reset to INITIAL_STABILITY, tune drops back to learning).
 *
 * @param {number} currentStability days
 * @param {string} rating easy | good | hard
 * @param {number} elapsedDays since the last practice on this instrument
 */
export function updateStability(currentStability, rating, elapsedDays = 0) {
  const s = clampStability(currentStability || INITIAL_STABILITY);
  if (rating === 'hard') return clampStability(s * HARD_FACTOR);

  const gain = STABILITY_GAIN[rating];
  if (!gain) return s;

  const scheduled = restDays(s);
  const dueness = scheduled > 0 ? Math.min(1, Math.max(0, elapsedDays) / scheduled) : 1;
  return clampStability(s * (1 + (gain - 1) * dueness));
}

function clampStability(s) {
  return Math.round(Math.min(MAX_STABILITY, Math.max(MIN_STABILITY, s)) * 100) / 100;
}

/**
 * Suggest a learning tempo based on last practiced tempo and target.
 * Progression:
 *   < 75% of target → +10%
 *   < 90% of target → +5 BPM
 *   otherwise       → +2%
 * Returns { suggestion, isFirstTime }.
 */
export function suggestLearningTempo(currentTempo, targetTempo) {
  if (!currentTempo || currentTempo <= 0) {
    return { suggestion: 60, isFirstTime: true };
  }
  const suggestion = Math.round(nextLearningTempo(currentTempo, targetTempo));
  return { suggestion, isFirstTime: false };
}

export function nextLearningTempo(currentTempo, targetTempo) {
  if (!targetTempo || targetTempo <= 0) return currentTempo * 1.10;
  const ratio = currentTempo / targetTempo;
  if (ratio < 0.75) return currentTempo * 1.10;
  if (ratio < 0.90) return currentTempo + 5;
  return currentTempo * 1.02;
}

/**
 * Get the tempo to reset to when a "playing" tune is sent back to "learning".
 */
export function relearnTempo(targetTempo) {
  return Math.round((targetTempo || 100) * RELEARN_TEMPO_FACTOR);
}

/**
 * Check if a tune was already practiced today (for the given instrument).
 */
export function practicedToday(tune, instrument) {
  const data = tune.instruments?.[instrument];
  if (!data?.last_practiced) return false;
  const last = new Date(data.last_practiced);
  const now = new Date();
  return last.toDateString() === now.toDateString();
}

/**
 * Derive proficiency for a tune+instrument from BPM data.
 * Returns 'playing' if current >= target, otherwise 'learning'.
 */
export function instrumentProficiency(tune, instrument) {
  const data = tune.instruments?.[instrument];
  if (!data) return null;
  if (data.current_tempo >= data.target_tempo && data.target_tempo > 0) return 'playing';
  return 'learning';
}

const DUE_RISK_THRESHOLD = 0.5;

/**
 * Whether a tune belongs in today's practice queue. Learning tunes are
 * always due — daily practice while a tune is actively being worked on.
 * Playing tunes rest until enough forgetting risk builds up (risk >= 0.5,
 * reached ~0.69 × stability days after the last practice), so well-known
 * tunes come back progressively less often as their stability grows.
 */
export function isDue(tune, instrument) {
  const prof = instrumentProficiency(tune, instrument);
  if (!prof) return false;
  if (prof === 'learning') return true;
  const data = tune.instruments[instrument];
  const risk = forgettingRisk(daysSince(data.last_practiced), data.stability || INITIAL_STABILITY);
  return risk >= DUE_RISK_THRESHOLD;
}

/** Days a tune rests at a given stability before it comes due again. */
export function restDays(stability) {
  return -(stability || INITIAL_STABILITY) * Math.log(1 - DUE_RISK_THRESHOLD);
}

/**
 * Days until a playing tune comes due; 0 when it is due now (or learning).
 */
export function dueInDays(tune, instrument) {
  if (isDue(tune, instrument)) return 0;
  const data = tune.instruments?.[instrument];
  return Math.max(0, restDays(data?.stability) - daysSince(data?.last_practiced));
}

/**
 * How long a playing tune will rest if it is rated `rating` right now: the
 * point where its forgetting risk climbs back to the due threshold. Shown on
 * the rating buttons, so it has to be told the same `elapsedDays` the save
 * path will use — rating a tune early earns less, and the button must say so.
 */
export function nextIntervalDays(stability, rating, elapsedDays = 0) {
  return restDays(updateStability(stability, rating, elapsedDays));
}

/**
 * Compact interval label: "<1d", "2d", "12d", "1.3mo", "1.4y". Days are
 * always whole.
 */
export function formatInterval(days) {
  if (!(days >= 1)) return '<1d';
  if (days < 31) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30.4).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export { INITIAL_STABILITY };
