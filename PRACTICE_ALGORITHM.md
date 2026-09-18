# Practice scheduling

How tunebox decides which tunes to show you and when they come back. This is
the reference for `src/lib/practice-algorithm.js` — read it before changing any
constant in that file, and update it when you do.

Last revised: 2026-09-17 (stability model rewritten; see [History](#history)).

## What is stored

Everything lives on `user_tunes.instruments`, keyed by instrument name — a tune
can be at a different stage on whistle than on concertina, and each entry is
scheduled independently:

```jsonc
"Concertina": {
  "current_tempo": 156,      // fastest BPM you've played it cleanly
  "target_tempo": 155,       // the goal you set when you started it
  "stability": 7.22,         // days — how long it holds before you lose it
  "last_practiced": "2026-09-16T22:42:07.565Z",
  "keys": []
}
```

There is no separate schedule table and no stored due date. Due-ness is derived
from `stability` + `last_practiced` every time the queue is built, so changing
the rules changes everyone's schedule immediately — except `stability` itself,
which is a *running value* and therefore needs a migration (see
[Changing the rules](#changing-the-rules)).

## Two stages

`instrumentProficiency(tune, instrument)` derives the stage from tempo alone:

| stage | condition | scheduling |
|---|---|---|
| **learning** | `current_tempo < target_tempo` | due **every day** |
| **playing** | `current_tempo >= target_tempo > 0` | due when forgetting risk reaches the threshold |
| not started | no entry for that instrument | never queued |

A tune graduates from learning to playing the first time you log a practice at
or above its target tempo. "Couldn't play it — need to relearn" sends a playing
tune back the other way: `current_tempo` drops to `0.8 × target_tempo`
(`relearnTempo`) and stability resets to 1 day.

**Stability is only consulted in the playing stage.** Learning tunes come back
tomorrow no matter what it says — which is why learning-mode practices leave it
untouched (see [History](#history) for what happened when they didn't).

## When a playing tune comes back

The memory model is a single exponential decay:

```
forgettingRisk(t, S) = 1 − e^(−t / S)      t = days since last practice
```

A tune is due once that risk reaches `DUE_RISK_THRESHOLD` (0.5), which is:

```
restDays(S) = −S · ln(1 − 0.5) ≈ 0.69 · S
```

So **stability 10 days ⇒ the tune rests about 7 days**. The threshold is the
retention you're willing to live with at the moment of review: lower it to see
tunes sooner and know them better, raise it to see them less and rely on
scraping through. 0.5 is deliberately looser than Anki's ~0.9 — half-remembering
a tune and pushing through it is normal practice, not a failure.

`isDue()` gates the queue; `practicedToday()` then removes anything already
played today, so a tune never appears twice in one day.

## How stability moves

`updateStability(stability, rating, elapsedDays)` — all three arguments matter.

```
dueness = min(1, elapsedDays / restDays(S))     // 1.0 = played on or after its due day

easy     S' = S · (1 + 1.2 · dueness)           // → ×2.2 at most
good     S' = S · (1 + 0.6 · dueness)           // → ×1.6 at most
hard     S' = S · 0.75                          // ignores elapsed
relearn  S' = 1.0                               // and the tune drops back to learning

S' is clamped to [1, 180] days
```

Three properties this is built to have, each of which is a decision you can
revisit:

**1. Growth is proportional to the rest you actually used.** Playing a tune the
day after you last played it earns a sliver of the growth; playing it on
schedule earns all of it. Without this, a tune practised daily from the tune
page would inflate to a year-long interval in a week (1.6⁷ ≈ 27×). With it, a
week of daily practice on a 10-day tune earns 11.2 days — about what one
on-time review earns.

**2. Being late is never worth more than being on time.** `dueness` is capped at
1, so a tune left for three months and then played well lands exactly where an
on-time success would have put it. Anki and FSRS both pay a bonus for overdue
success — the longer you waited and still passed, the stronger the memory
provably was — and we deliberately don't. Under-resting a tune you still know
is a cheaper mistake than over-resting one you've quietly lost. The cost is
real: a tune you genuinely still own after three months gets rescheduled as
though it were a 12-day tune, and needs a few reviews to climb back.

**3. "Hard" is a pass you struggled through, not a failure.** It shrinks
stability from where it was and ignores elapsed time, so the tune returns sooner
than the gap you just survived. The fail button is "need to relearn", which
resets to day one and puts the tune back in the learning stage.

### Constants

In `src/lib/practice-algorithm.js`:

| constant | value | raise it to… |
|---|---|---|
| `INITIAL_STABILITY` | 1.0 | start graduated tunes further up the ladder |
| `MIN_STABILITY` | 1.0 | stop tunes ever being due more than once a day |
| `MAX_STABILITY` | 180 | let mastered tunes disappear for longer than ~4 months |
| `STABILITY_GAIN.good` | 1.6 | climb faster on ordinary successes |
| `STABILITY_GAIN.easy` | 2.2 | reward effortless runs harder |
| `HARD_FACTOR` | 0.75 | soften the penalty for a struggled pass (→1.0 = no penalty) |
| `DUE_RISK_THRESHOLD` | 0.5 | trade retention for fewer reviews |

Rest days at each rung, assuming every review is on schedule:

```
all good:  1.1  1.8  2.8  4.5  7.3  11.6  18.6  29.8  47.7  76.3
all easy:  1.5  3.4  7.4  16.2  35.7  78.6  → capped at ~125
```

Ten clean reviews to reach a ten-week interval. Four "hard"s in a row take a
20-day tune back to 4.4 days.

### What the rating buttons show

`nextIntervalDays(stability, rating, elapsedDays)` drives the day labels on the
Easy/Good/Hard buttons, and must be passed the same `elapsedDays` the save path
will use — otherwise the buttons promise growth the model won't deliver.

One consequence worth knowing: when you practise a tune *early*, dueness is near
zero and all three buttons show nearly the same number (e.g. a 28-day tune
played 12 hours after its last practice shows 28d / 28d / 21d). That is honest —
whatever you press, an early review barely moves the schedule — but it looks
odd if you don't know why.

## Ordering the tunes that are due

`calculatePriority` only sorts the tunes that `isDue` already admitted:

```
priority = 0.01 · max(0, target_tempo − current_tempo)   // W1 — tempo gap
         + 10 · forgettingRisk                           // W2 — how faded
         + sigmoid(forgettingRisk − 0.7) · 5             // BOOST — the nearly-lost
```

Forgetting risk dominates; the tempo gap is a tiebreaker that nudges tunes you
are actively pushing toward their target. The sigmoid boost pulls tunes on the
edge of being lost to the front.

Queue assembly (mixing single tunes with whole sets, honouring tag filters and
`?set=` deep links) lives in `src/hooks/use-practice.js`; a ready set is
scheduled as one item off its *weakest* member, and one rating writes to every
tune in it. See the Sets section of `CLAUDE.md`.

## Where the rules are enforced

| path | file | stability effect |
|---|---|---|
| learning practice | `saveLearningPractice` | unchanged — unless the tune graduates, then reset to 1.0 |
| "Couldn't play it yet" | `saveLearningStruggle` | unchanged (logs `fluency_rating: 2` for history only) |
| playing rating | `savePlayingPractice` | `updateStability(S, rating, daysSince(last_practiced))` |
| "need to relearn" | `savePlayingPractice` | reset to 1.0, tempo back to 80% of target |
| whole set | `saveSetPlayingPractice` | the set's one rating applied to each member individually |
| start learning | `handleStartLearning` (`src/pages/practice.jsx`) | seeded at 1.0 |

`practice_log` stores a numeric `fluency_rating`: easy 5, good 4, hard 2,
relearn 1; learning practices log 4 and struggles log 2. Anything replaying
history (the migration script, the repertoire chart) maps those back to rating
words — keep the two in sync if you add a rating.

## Changing the rules

Stability is stored, not derived, so **changing the constants does not fix
existing records** — they keep whatever the old rules left behind.

```bash
node scripts/migrate-stability.mjs           # dry run: prints a before/after table
node scripts/migrate-stability.mjs --apply   # backs up PocketBase, then writes
```

The script replays every tune's `practice_log` through the *current*
`updateStability`, starting the ladder at the first practice logged at or above
target tempo. It is idempotent — a second dry run after applying reports zero
changes — and it skips learning tunes entirely, since their stability is unused.
A playing tune whose log contains no qualifying practice (progress typed in by
hand, history older than the log) is reset to the first rung rather than given a
number the replay cannot justify.

When you change a constant, do this before shipping it:

1. Replay a real tune's history at the new numbers and read the trajectory —
   `scripts/migrate-stability.mjs` prints the endpoint; add a per-step trace if
   you need to see the shape.
2. Check the three properties above still hold, especially the cramming case
   (repeat "good" daily and watch it not run away).
3. Run the dry run to see every affected tune before touching the database.

## History

**2026-09-17 — stability rewritten.** The original model multiplied stability by
a fixed factor per rating (easy ×1.4, good ×1.1, hard ×0.65), with no floor, no
cap, and no reference to elapsed time. Four flaws compounded:

- **Learning-mode presses fed the same ladder.** "Couldn't play it yet" logged
  `fluency_rating: 2` and was multiplied through as a playing-mode "Hard", so a
  tune could reach the playing stage with a stability far below a day.
- **Nothing floored it.** Stability was a bare product, free to fall toward
  zero.
- **The factors were lopsided.** One "hard" (×0.65) undid 4.5 "good"s (×1.1),
  and ×1.1 needed seven successes just to double — it could never outrun a bad
  run.
- **Elapsed time was ignored.** Playing a tune successfully after a 22-day gap
  scored exactly the same as playing it a day after the last attempt. The model
  could not learn from the intervals you actually survived.

The tune that surfaced it was *O'Neill's* (march, concertina): played since
June, at target tempo, with a stability of **0.15 days** — due again 2.5 hours
after every practice, and rating it "Easy" bought 3.5 hours. Across the library
the best tune of four months' work was resting 7.6 days. After the rewrite and
the replay migration, O'Neill's sits at 7.22 (5 days) and the strongest tunes at
~46 (32 days).

The elapsed-time handling was the contested part of the design. The first draft
anchored growth directly to elapsed time (`max(S, elapsed/0.69 × gain)`), which
is closer to how FSRS works but paid a large bonus for neglect — a 90-day pass
scored 13× an on-time one. It was replaced with the capped `dueness` form above
so that discipline is never worth less than neglect.
