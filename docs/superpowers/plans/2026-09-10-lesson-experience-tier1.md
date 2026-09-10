# Lesson experience, Tier 1 — shipped

Date: 2026-09-10
Follows: `2026-09-10-lesson-experience-review.md` (the diagnosis)
Scope: the four component-level fixes from that review's Tier 1, plus the
visual finding that came out of a design-system pass.

---

## The one change that mattered most

Every correct answer in the French course printed the grader's own return value
to the learner. Before:

```
correct
That matches an authored answer.
[ Save and continue ]
```

After:

```
Nice — that's the one.
Bonjour.
Say it out loud once before you continue.
[ Continue ]
```

`correct` was `Evaluation.category` — a machine-facing label produced by
`answer.ts` and rendered straight into `<strong>` by `ExerciseView`. `text-transform:
capitalize` in `study.css` existed only to disguise the lowercase slug. The string
"That matches an authored answer" was `Evaluation.explanation`, written for a
grader and shown to a person.

Learner-facing wording now lives in one module, `src/features/course-pack/feedback.ts`,
and the grader's category never leaves the grader. `tests/exercise-feedback.test.tsx`
fails if any taxonomy string reaches the screen.

### What the new feedback does

| Situation | Learner sees |
| --- | --- |
| Correct, produced (think / translate / cloze / order / dictation) | rotating warm ack from a set of five, the target form, and *Say it out loud once before you continue.* |
| Correct, recognition (choice) | same ack, no spoken nudge — they did not produce it |
| Acceptable alternative | the ack, plus *the form below is the one you will hear most* |
| Accepted with a small typo | the ack, plus a nudge to fix the spelling in their head |
| Near miss / accent / word order / missing / extra word | a specific headline (*Almost — the accents are off.*) and the authored diagnostic, which was already good and is kept verbatim |
| Model revealed | *Here's the model.* — no false credit |

Acknowledgements rotate deterministically off the exercise id, so a lesson never
repeats one catchphrase, the same answer always gets the same reply, and the
string is pinnable in a test (SSR-safe).

The v2 runtime's `outcomeWord` was the same class of problem — `Correct.` /
`Noted.` / `Hold on.` — and now reads `That's it.` / `Thanks — that shapes what
comes back next.` / a real saving or connection message. The guided session's
`That matches an accepted answer.` is gone too.

**The spoken nudge is doing double duty.** The review found the course never asks
the learner to speak — no speaking activity exists in any pack. That needs a new
activity kind and audio. Until then, every produced answer ends with an
instruction to say it out loud, which costs nothing and is the highest-frequency
place a beginner could practise.

## Chrome leak closed

Every practice step rendered the course footer inside the activity flow:
"Keep a practice backup", an export button, an import file input, and
"Twenty-four original A1 foundation lessons… Machine-authored and
consistency-checked; native-speaker editorial review remains open."

The lesson shell guarded the header, title, lede, tabs and download panel on
`practising`, but the storage footer and the provenance line sat outside that
guard. Both are now suppressed during a session, confirmed on all seven steps of
a Lesson 0 walk (previously `backup=true provenance=true` on every step).

## The session now ends with a payoff

Before: `Practice complete` + *"A completed practice session is not a proficiency
certificate."* + `[Back to course]`.

After:

```
Session finished
First words — done.
You used 3 expressions in French just now:
Bonjour. · Merci. · Bonjour, merci.
Say them out loud once more before you move on — that is the rep that counts.
[ Next: Names and introductions ]  [ Back to course ]
Saved on this device. Missed or revealed answers stay in review.
```

The list is the target-language forms the learner actually got credit for,
accumulated during the session. `Next` appears only when the next lesson's
prerequisites are met, so it can never open a locked lesson. When nothing landed
first try, the screen says so plainly and explains why those items come back
sooner, rather than apologising.

## Visible accumulation

The only progress signal in a lesson was `Practice 3 of 7`, which measures effort
and never progress. The session header now also carries:

```
USED THIS SESSION  Bonjour. · Merci.
```

No XP, no streak, no score — the landing page promises none of those — but the
learner can see the session building. The duplicate counter that rendered the
same `Practice N of M` twice was removed.

## Outcome states (a real gap, not a preference)

In the French lesson a right answer and a wrong answer rendered in **the identical
glass panel**. The Italian (v2) engine had its own pair of outcome colours; the
v1 engine had none at all, and `data-outcome` did not exist in `study.css`.

The practice panel now carries `data-outcome="correct" | "attention" | "neutral"`,
tinted with tokens defined in `globals.css` (`--state-correct-fill/-line`,
`--state-attention-fill/-line/-ink`). It is a **redundant** cue: the headline
already states the outcome, and colour is never the only signal.
`tests/exercise-feedback.test.tsx` pins all three states.

## The visual finding: three palettes, two type stacks

Answering "would a visual refresh help?" — the honest answer is that the app does
not need a new look, it needs **one** look. Measured on `main`:

| Role | `globals.css` (shell) | `--lp-*` (Italian lesson) | `study.css` (French lesson) |
| --- | --- | --- | --- |
| paper | `#f4f3ee` | `#f5f3ee` | `#f5f3ee` |
| ink | `#1a1f1e` | `#222e2c` | `#222e2c` |
| muted | `#586360` | `#536560` | `#536560` |
| accent | `#1e6563` | `#176a61` | `#176a61` |
| surface | `#ffffff` | `#fffdfa` | `#fffdfa` |
| glass tokens | 8 defined | 0 consumed | 0 consumed |

The two lesson surfaces agree with each other and both disagree with the app
shell. The Liquid Glass material tokens Steven asked for
(`--glass-fill`, `--glass-blur`, `--glass-edge`, `--glass-highlight`,
`--glass-shadow`, `--radius-glass`) have existed in `globals.css` since that
work — the lesson surfaces never consumed them and instead re-typed the recipe
inline (the literal `blur(22px) saturate(1.8)` appears repeatedly in `study.css`).

And the loudest signal of all: the French lesson set its **body copy in `Arial`**
and all of its **headings in `Georgia`**, while every other screen in the app
renders Instrument Sans and Newsreader. The screen a learner spends nearly all
their time on was the one screen not in the product's typeface.

### Fixed now

- `.study` body and `.study h1/h2/h3` read `var(--font-body, …)` /
  `var(--font-display, …)`, with the old values as fallbacks so the offline
  portable bundle (which ships `study.css` without `globals.css`) stays readable.
  The Georgia on the cloze line and the session summary moved to the same
  display token.
- `DESIGN.md` written at the repo root, linting **0 errors, 7 expected
  `orphaned-tokens` warnings**, documenting the identity that already exists
  (warm paper, one teal accent, glass as a material), the type floor, the state
  tokens, and a **Known Gaps** section carrying the table above with the
  migration still to do.

### Still to do (mechanical, CSS only, no markup changes)

Migrate `--lp-*` and the local `study.css` variables onto the shell tokens and
delete the duplicates; replace every inline glass recipe with the `--glass-*`
tokens. This is the whole remaining "refresh" and it is a find-and-replace, not a
redesign.

---

## Verification

| Gate | Before | After |
| --- | --- | --- |
| `npx vitest run` | 810 passed | **817 passed**, 0 failed (122 files) |
| `npx playwright test` (full) | 62 passed | **62 passed**, 0 failed |
| `npx tsc --noEmit` | clean | clean |
| `npx eslint src` | 0 errors, 8 warnings | 0 errors, 8 warnings (pre-existing) |
| `npx next build` | green | green |
| `npx @google/design.md lint DESIGN.md` | n/a | 0 errors, 7 expected warnings |

### Specs rewritten, not deleted

`tests/e2e/helpers/complete-l0.ts`, `course-packs.spec.ts`, `thinking-lesson.spec.ts`
and `portable.spec.ts` waited on `getByRole('status')` containing the text
`"correct"` — a pin on the grader's category. They now wait on and assert
`data-outcome`, which is both more precise and copy-independent. Five e2e tests
failed on the first full run for exactly this reason, and the failures are the
evidence that the copy changed.

`tests/ThinkExercise.test.tsx` asserted `findByText("correct")`; it now asserts
the acknowledgement pattern and explicitly asserts the word `correct` is **not**
present.

`tests/GuidedSession.test.tsx`, `ClozeBuilder.test.tsx`, `a11y-session.test.tsx`
and the guided-session spec were updated to the new verdict wording, including
the negative assertion at `GuidedSession.test.tsx:440`.

### Guards added

- `tests/exercise-feedback.test.tsx` (7 tests) — pins the acknowledgement set, the
  spoken nudge appearing only for produced answers, the specific miss diagnostic,
  the `Continue` label, and all three `data-outcome` states.
- `tests/copy-guard.test.ts` — three new bans: `authored answer`,
  `matches an accepted answer`, `save and continue`. The guard scans every `.tsx`
  under `src/`, so the grader's vocabulary cannot creep back into a component.

## Not done, deliberately

- **Lesson 0 rewrite** (hear → say → recognise → build, cutting the etymology and
  counting steps) — Tier 2, content, and it should follow a proven template.
- **Breaking the L2–L24 clone** — 23 lessons of editorial work.
- **The `--lp-*` / `study.css` token migration** — described above, mechanical.
- **Speaking as a first-class activity** — needs a new activity kind, a renderer
  wired to `VoiceRecorder`, and audio for every target form. The spoken nudge is
  the stopgap.
