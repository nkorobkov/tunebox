/**
 * Practice priority and stability algorithm.
 *
 * Each tune's instrument entry stores:
 *   stability    — how well-learned (days); higher = more resistant to forgetting
 *   last_practiced — ISO date string of last practice
 *   current_tempo  — BPM the user can reliably play at
 *   target_tempo   — goal BPM
 *
 * Priority formula:
 *   priority = W1 * (target - current) + W2 * forgettingRisk
 *   priority += sigmoid(forgettingRisk - 0.7) * BOOST
 *
 * forgettingRisk = 1 - exp(-t / S)
 *   where t = days since last practice, S = stability
 */

const W1 = 0.01;
const W2 = 10;
const BOOST = 5;
const INITIAL_STABILITY = 1.0;
const TEMPO_INCREMENT = 1.1;
const RELEARN_TEMPO_FACTOR = 0.8;

const STABILITY_MULTIPLIERS = {
  easy: 1.4,
  good: 1.1,
  hard: 0.65,
};

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
 * Returns new stability value.
 */
export function updateStability(currentStability, rating) {
  const s = currentStability || INITIAL_STABILITY;
  const multiplier = STABILITY_MULTIPLIERS[rating];
  if (!multiplier) return s;
  return Math.round(s * multiplier * 100) / 100;
}

/**
 * Suggest a learning tempo based on last practiced tempo.
 * Returns { suggestion, isFirstTime }.
 */
export function suggestLearningTempo(currentTempo) {
  if (!currentTempo || currentTempo <= 0) {
    return { suggestion: 60, isFirstTime: true };
  }
  return {
    suggestion: Math.round(currentTempo * TEMPO_INCREMENT),
    isFirstTime: false,
  };
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

export { INITIAL_STABILITY, TEMPO_INCREMENT };
