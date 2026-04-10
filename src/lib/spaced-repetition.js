/**
 * SM-2 spaced repetition algorithm adapted for tune practice.
 *
 * Fluency ratings:
 *   1 = blackout (couldn't play it)
 *   2 = hard (many mistakes)
 *   3 = ok (some hesitation)
 *   4 = good (minor issues)
 *   5 = easy (nailed it)
 */

export function calculateNextReview({ interval_days = 1, ease_factor = 2.5, consecutive_correct = 0 }, fluencyRating) {
  let interval = interval_days;
  let ease = ease_factor;
  let streak = consecutive_correct;

  if (fluencyRating < 3) {
    // Failed — reset
    streak = 0;
    interval = 1;
  } else {
    // Passed
    streak += 1;
    if (streak === 1) {
      interval = 1;
    } else if (streak === 2) {
      interval = 3;
    } else {
      interval = Math.round(interval * ease);
    }
  }

  // Adjust ease factor (SM-2 formula)
  ease = ease + (0.1 - (5 - fluencyRating) * (0.08 + (5 - fluencyRating) * 0.02));
  ease = Math.max(1.3, ease);

  const next_review = new Date();
  next_review.setDate(next_review.getDate() + interval);

  return {
    next_review: next_review.toISOString().split('T')[0] + ' 00:00:00.000Z',
    interval_days: interval,
    ease_factor: Math.round(ease * 100) / 100,
    consecutive_correct: streak,
  };
}

export function isDue(tune) {
  if (!tune.next_review) return false;
  return new Date(tune.next_review) <= new Date();
}

export function isNew(tune) {
  return !tune.next_review;
}
