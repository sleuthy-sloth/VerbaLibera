# Phase 5 implementation plan — one next action, and progress a learner can read

Date: 2026-09-11. Source: `docs/superpowers/plans/2026-09-10-development-roadmap.md` §9.
Branch: `hermes/hermes-830d4bcc`. Scope: the dashboard next-action engine and the
learner-readable progress indicators. Placement improvement (§9 last bullet) and account-side
foundation preference sync are **not** in this slice — see "Explicitly pending".

## Findings from the current source (before changing anything)

1. **The dashboard's "next" is three different questions, and the foundation courses are not one
   of them.** `DailyPathDashboard.tsx` decides with `hasGuidedSession ? 'Continue today's lesson'
   : foundationHref ? 'Open French foundations' : 'being authored'`. The first branch reads
   `progress.session`, which the snapshot composes from the **travel fixture**
   (`initialCourses` + `composeLessonSession`); the second is a bare link to the course page and
   says nothing about where in the course the learner is. Nothing on the page reads the
   foundation course's own progress.
2. **Foundation progress exists and is unreachable from the dashboard.** `RuntimeCourseWorkspace`
   projects it client-side with `projectLessonEvidence(pack, events)` over events in IndexedDB
   (`readLessonEvents`), and computes `next`/`completeCount` locally (lines 40–73). The dashboard
   has no path to either: no pack, no events.
3. **Due reviews are counted twice, differently.** `DemoProgressSnapshot.dueReviewCount` counts
   v1 `UserProgress` rows (accounts) or travel-fixture drills (guests). The v2 evidence queue has
   its own `dueAt` per evidence key in `LessonEvidence.evidence`, projected but never surfaced.
   A learner can be "caught up" on the dashboard while their foundation SRS queue has items.
4. **There is no unfinished-session signal anywhere.** `readCheckpoint(packId, lessonId)` exists
   per lesson; there is no way to ask "which lesson did I leave half-done?", so the dashboard
   cannot offer to finish it. `LessonPlayer` writes a checkpoint on every step (line ~652) and
   resumes from it — the data is already there, unreadable in aggregate.
5. **An unfinished session is invisible in the only place it matters.** Reopening the course
   shell always lands on the *intro card* of the first incomplete lesson, never on "you were
   halfway through this".
6. **The learner's own time budget is stored and unused by the dashboard.** A stored study plan
   carries `minutesPerDay` (5 | 8 | 15) and the dashboard reads the plan only to print a status
   line (`planSummary`). The next action does not consider how long the learner said they have.
7. **Progress wording on `/you` is composed from `progress.session`** (`sayablePhrases()` looks
   for `kind === 'NEW_PATTERN'` steps), so a learner who has practised 20 foundation phrases
   sees "Nothing yet" — the exact opposite of an honest progress indicator.

## The slice

One dashboard card, decided by one pure function:

| Piece | Contract |
| --- | --- |
| `src/features/progress/next-action.ts` | `selectNextAction(input): NextAction` — pure, deterministic, no storage and no clock. Returns exactly one action: `{ reason, label, detail, href, minutes, optional }`. |
| `src/features/progress/learning-summary.ts` | `summarizeLearning(pack, events, now): LearningSummary` — phrases practised, situations attempted, what to revisit, and **separate** recognition / production / listening / self-assessment figures. |
| `src/features/progress/foundation-progress.ts` | `buildFoundationProgress(pack, language, events, checkpoints, now): FoundationProgress` — pure assembly of the projection into the engine's own input shape (completed lessons, next open lesson, unfinished draft, due evidence count, whether there is any practice at all). |
| `src/features/progress/use-foundation-progress.ts` | The only I/O: local lesson events + checkpoints (IndexedDB) and the course pack (`/packs/<language>.json`), scoped per account. Returns `loading / ready / unavailable`; **never throws, never invents data.** |
| `src/features/course-pack/storage.ts` | `readCheckpoints(userId?)` — list saved drafts. The checkpoints store already exists; nothing else changes. |
| `src/features/course-pack/attempts.ts` | `skillMode` becomes exported so the summary buckets skills with the same function the projection uses. |

### Decision order (documented, and pinned by test)

```
no course                                  → choose-course
foundation practice exists on this device:
    saved draft                            → resume-lesson   ('Finish <lesson>')
    evidence due                           → review          ('Review N phrases')
    an open lesson                         → next-lesson
    nothing open                           → all-done
no foundation practice:
    a guided session step (snapshot)        → next-lesson     ('Continue today's lesson')  [unchanged]
    due v1 reviews, on the authored course  → review
    a course to open                        → start-course    ('Open <Language> foundations') [unchanged]
```

Two rules make this honest rather than clever:

- **Local evidence outranks the snapshot.** A device with foundation practice is the only case
  where the dashboard knows something new; where it does not, the existing branches and their
  copy are preserved exactly, so a first-visit guest still gets the same three-words-or-fewer
  entry the e2e suite already probes.
- **`minutesAvailable` (the learner's own `minutesPerDay`, else 10) bounds the review action**:
  `take = clamp(floor(minutes / 2), 1, due)`. "Review 4 of 11 waiting" in a 8-minute plan is a
  sentence a learner can act on; "11 reviews waiting" is not.
- **A met daily goal makes the action optional, never withheld**: `optional: true` changes the
  copy to "you have done today's steps; this one is extra" and nothing is taken away. No streaks,
  no lost hearts, no penalty state.
- **Every action has somewhere to go.** The old card's last branch was a status line ("lessons are
  being authored") with nothing to click. `href` is now non-nullable: the fallback is the
  learner's own course page.

### Two corrections the tests forced (they are the reason this slice is test-first)

1. **The snapshot's due queue is gated on the authored course.** Offering it for whichever course
   happened to be selected produced `/learn/english-to-german` — a session that was never
   composed for German, i.e. the dead link `DailyPathDashboard.test.tsx` already guarded. The
   engine takes `guided.isAuthoredCourse` as a separate signal from `guided.hasSessionStep`: a
   course can have a due queue and no step left, and a course can have neither.
2. **`start-course` must not depend on a successful device read.** Requiring a `foundation` block
   meant a learner whose pack fetch failed got an `all-done` with no way forward. The branch is
   unconditional now.

### What the summary keeps separate, and why

`projectLessonEvidence` already keeps the histories apart and is the single definition used:
`participationCompleted`, `legacyCredits`, `evidence` (per evidence key, with the existing SM-2
scheduler's `dueAt`), `skillCounts` (per skill, independent vs assisted), `quarantined`.

- `phrasesPractised` = evidence keys with `successes > 0`.
- `situationsAttempted` = distinct lessons with a live attempt or completion, plus
  `participationCompleted` and `legacyCredits`, over `pack.lessons.length`.
- `revisit` = evidence keys that are due (`dueAt <= now`) or shaky (`lastQuality < 3`), labelled
  with their concept title, most urgent first.
- `recognition` / `production` / `listening` = **one bucket per attempt**, chosen by
  `modalityForSkills(activity.skills)`, splitting independent from assisted. Deliberately *not*
  read off `skillCounts`: that counts a `['reading','vocabulary']` step under both skills, which
  would show a learner two recognition credits for one answer.
- `selfAssessment` = attempts on `self-compare` activities (they carry no `evidenceKey`, and the
  projection already excludes `self-assessed` outcomes from evidence). Reported as its own
  figure — a self-rating is not retrieval, and the summary must not be able to add it to one.

`skillMode` (evidence) and the summary's `modalityForSkills` (learner-facing) are deliberately
different mappings and both are pinned: `speaking` is production to a learner and recognition to
the scheduler. The test asserts that divergence rather than leaving it to drift.

## Files

- new `src/features/progress/next-action.ts`, `learning-summary.ts`, `foundation-progress.ts`,
  `use-foundation-progress.ts`
- `src/features/course-pack/storage.ts` (`readCheckpoints`), `attempts.ts` (export `skillMode`)
- `src/components/dashboard/DailyPathDashboard.tsx` (one action, reason line, practised block),
  `dashboard.module.css` (`.actionDetail`, `.practised`, `.revisit`, `.modalities`)
- tests: new `tests/next-action.test.ts`, `tests/learning-summary.test.ts`,
  `tests/foundation-progress.test.ts`, `tests/use-foundation-progress.test.ts`; extended
  `tests/DailyPathDashboard.test.tsx`, `tests/lesson-persistence.test.ts`,
  `tests/DashboardDataBoundary.test.tsx`

## Regression fixtures

- The authored pilot pack in `tests/fixtures/lesson-variety.ts` (three lessons, a real
  prerequisite chain, an evidence-keyed SRS queue, one `self-compare`) drives the engine and
  summary tests — not a synthetic stub, so the counts are real numbers.
- A guest with no local practice must produce today's exact copy and href; a stored plan's
  `minutesPerDay` must change the review count; a checkpoint on a lesson whose revision has
  moved on must not be offered as resumable.
- Every history figure is asserted to move independently: adding a self-assessment must not
  change `phrasesPractised`, and adding a listening attempt must not touch `production`.

## Acceptance commands

Run and green on this branch:

- `npx vitest run tests/next-action.test.ts tests/learning-summary.test.ts tests/foundation-progress.test.ts tests/use-foundation-progress.test.ts tests/DailyPathDashboard.test.tsx tests/lesson-persistence.test.ts tests/DashboardDataBoundary.test.tsx`
- `npm run test` — the whole suite
- `npx tsc --noEmit`
- `npx eslint` over the changed files

Not run in this slice (they need a browser and a served build; the card's copy they probe is
unchanged for a guest with no local practice):

- `env -u E2E_BASE_URL npx playwright test tests/e2e/daily-path.spec.ts tests/e2e/learning-release.spec.ts tests/e2e/a11y.spec.ts --project=chromium --workers=1`

The dashboard now reads `/packs/<language>.json` on first paint for the next action. That is the
same URL the course pages already fetch and the offline install already caches, so it is warm in
the browser cache after a course visit; a bundle-level optimisation (a slim progress-only pack
endpoint) is deliberately not in this slice.

## Rollback

Additive: four new modules, one new storage read, two dashboard blocks. The dashboard's existing
branches and copy survive verbatim as the engine's fallbacks, so reverting the dashboard commit
restores today's behaviour with no storage migration and no lost practice.

## Explicitly pending

- Placement items for the three courses that have none (§9 last bullet) — a separate slice.
- Account-side storage of foundation preferences with conflict rules (§9 second bullet): this
  slice reads the scope `usePracticeAccount()` already manages — the same store the course shell
  binds its environment to — so it adds no new sync rule and makes no identity request. A learner
  who has not opted into account practice is shown their guest practice, which is exactly where
  the lesson player would have written it. The conflict semantics are whatever `sync.ts` already
  implements for that scope; nothing here changes them.
- `?lesson=` deep links: `resume-lesson` points at `/courses/<language>?start=1`, which opens the
  first incomplete lesson — the saved draft's lesson whenever the preceding lessons are complete,
  which the prerequisite chain guarantees for the shipped packs. A branched curriculum would need
  the deep link, and the limitation is stated in the module.
