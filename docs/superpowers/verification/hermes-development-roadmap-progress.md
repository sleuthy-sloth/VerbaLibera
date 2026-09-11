# Hermes — development roadmap progress

Run started 2026-09-10. Model: **deepseek-v4-flash** (as instructed; no work routed elsewhere).
Roadmap source: `docs/superpowers/plans/2026-09-10-development-roadmap.md`.
Worktree: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera/.worktrees/hermes-830d4bcc`
Branch: `hermes/hermes-830d4bcc` (base `e825dd1`, from `feat/fr-it-variety`).

This file is updated as each phase lands. "Pending" below always means *not performed*, never
"assumed fine".

## Current phase

**Phases 0 and 1A complete; Phase 2A evidence complete, the pack flip deliberately not started.**
Phase 1B (the short entry sequence) and the 2A flip are the next packages.

## Phase status

| Phase | State | Notes |
| --- | --- | --- |
| 0 — baseline and reproducible release inputs | **Complete** | 0A report reconciliation, 0B reproducible bundles + CI parity |
| 1 — complete the first ten minutes | **1A complete, 1B not started** | 1A: onboarding state machine, completion/resume rules, placement capability. 1B: the short French/Italian entry sequence. The gate's observed five-user pilot is a human session and stays pending. |
| 2 — consistent activities and progress | **2A evidence complete; the flip not started** | Parity and replay proof on the real French pack. The mechanical flip plus the consumer/test updates it forces is the next commit and is deliberately not in this run. 2B content work is a separate package. |
| 3 — listening and speaking everywhere | Not started | 3B audio expansion needs native-speaker listening review (human) |
| 4 — curriculum depth | Not started | Needs editorial/native-speaker capacity; do not start before Phase 2 |
| 5 — daily practice and visible learning | Not started | Depends on stable event contracts from Phase 2 |
| 6 — verified releases | Not started | Physical-device QA and signing decisions are human tasks |
| 7 — evidence-led A2 / advanced tools | **Deliberately not started** | Conditional on reviewed A1 pilot and learning evidence that does not exist yet |

## Explicitly pending human work (do not report as done)

- Native-speaker review of any lesson or audio clip (`review.nativeSpeaker` stays `"pending"` in
  every generated report).
- The human listening checklist for audio (`review.audioListening` stays `"pending"`).
- The Phase 1 gate's observed pilot with five new users.
- Physical iPhone / Safari PWA QA, and any signed or notarised distribution decision.
- Deployment, release tagging, merging to `main`, and pushing: **not performed in this handoff.**

## Changes and evidence

### Phase 0A — reconcile status and content reports

Problem: `scripts/content.ts` counted `lesson.legacyExercises` as the course's exercise total and
derived `lessonsWithAudio` from the existence of a legacy `dictation`. For the Italian v2 pack
that reported 199 "exercises" while a learner actually meets 259 reachable activities, and it made
the entire speaking rollout invisible in the numbers that govern expansion.

What changed:

- New `scripts/content/report.ts` (`buildContentReport`) produces a schema-aware report. Reachable
  runtime activities and retained v1 records are counted and labelled separately; every metric
  carries a `basis` string naming what it counts and over what denominator.
- `scripts/content.ts` uses it for every command and writes it to `docs/astra/reports/<language>.json`.
- New `tests/content-reporting.test.ts` (19 tests) pins the reporting contract against the raw
  manifests: reachability is recomputed independently of the reporter, denominators must add up,
  no report may claim a complete A1 level from lesson count, review status must stay `pending`, and
  each committed report must equal a fresh computation.
- `README.md`, `docs/cefr-coverage.md` and `docs/astra/phase-status.md` now carry measured numbers
  and split foundation-course coverage from the older travel fixture.

Measured result (generated, `npm run content:stats`):

| Course | Schema | Lessons | Practice activities | Notice steps | Speaking | Lessons with model audio |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| French | v1 | 25 | 222 | 25 | 0 | 25/25 |
| Italian | v2 | 25 | 233 | 26 | 23 | 25/25 |
| German | v1 | 8 | 48 | 8 | 0 | 1/8 |
| Portuguese | v1 | 8 | 48 | 8 | 0 | 1/8 |
| Spanish | v1 | 8 | 49 | 8 | 0 | 1/8 |

74 lessons, 600 practice activities, 23 speaking steps. Italian's 259 reachable activities now
appear; its 199 retained v1 records are reported separately.

Two findings recorded rather than fixed here: the Italian v2 pack carries no `cefr` tag on its
lessons or concepts (metadata gap), and `self-compare` speaking exists in Italian only.

Gate check — "Italian's live activities appear in reporting; metrics explain their denominator; no
generated report claims full A1 from lesson count": met, pinned by test.

### Phase 0B — reproducible bundles and release checks

Problem 1: `scripts/content.ts` composed `public/study.css` from the canonical lesson stylesheet
**plus the previous contents of the generated `public/study.css`**. Reproduced in isolation with
the old expression (canonical source prepended to the previous generated file, starting from the
bundle's own CSS as esbuild writes it):

    start (bundle CSS only): 105 bytes
    after build 1: 22492 bytes
    after build 2: 44879 bytes
    after build 3: 67266 bytes      (source stylesheet alone: 22386 bytes)

So the old line is self-amplifying. In the real repo the file stayed at 34142 bytes across three
consecutive builds *only* because the esbuild step overwrote `public/study.css` with the bundled
lesson-player CSS first — the accumulation was masked, not absent. Fix: build with `write: false`
and compose the artifact explicitly from `src/features/course-pack/study.css` + the bundle's own
CSS output, throwing if either is missing. No generated file is read. Verified byte-preserving:
`public/study.{js,css,html}` and `catalog.json` were unchanged by the fix.

Problem 2: CI ran `npx next build`, skipping `prebuild` (the deployment-import guard and the
content build) and the `next build --webpack` pin the shipping path relies on. CI now runs
`npm run build`.

Problem 3: the deployment-import guard and the voice-service contract tests had no CI coverage.
Both now have explicit named steps. The voice-service suite needs only
`fastapi`/`uvicorn`/`python-multipart`/`httpx`/`pytest` because the speech and translation engines
are lazily imported — verified locally: **42 passed** with that dependency set and no model
environment.

New `tests/content-build-reproducibility.test.ts` pins: two successive builds are byte-identical;
the generated artifact set leaves no unexplained diff against the index; `public/study.css`
contains the canonical source block exactly once and still carries the player styles; and the
accumulation detector can fail (replaying the old composition yields two source blocks).

Gate check — "clean repeated build; no unexplained generated diff; CI exercises the intended
shipping build path": met, pinned by test.

### Phase 1A — onboarding completion, resumption and capability

Problems found in the source before changing it:

1. `WelcomeFlow.tsx` re-implemented the flag map, availability heuristic and benefit copy inline
   while `src/features/onboarding/state.ts` had the same three things and
   `src/features/onboarding/languages.ts` wrapped them with **no callers at all**.
2. Placement was offered for every displayed language. Only French and Italian have authored item
   sets; Spanish and Portuguese get the A1-only travel fallback, and for German the route does not
   exist (`generateStaticParams` covers the four travel-fixture slugs only). The dashboard's own
   "Take the 3-minute placement quiz" link interpolated `/learn/<course>/placement` for whatever
   course was selected — a dead link for German.
3. Nothing in production ever wrote `status: 'completed'`. Both buttons wrote
   `'welcome-in-progress'` and left it there, and the dashboard treated any stored record as "seen",
   so a learner who quit mid-flow never saw the starting-point screen again.
4. `chooseLanguage` called `setSelectedCourse` on the radio change, before Continue — browsing
   languages silently rewrote the saved course.
5. Corrupt storage and denied storage were indistinguishable from a new learner, so both re-asked
   with no explanation.

Changes: `OnboardingLanguage.placement` derived from the authored sets; `onboardingDestination`
refuses an unsupported placement and a new `preview` intent routes to the course page;
`completeOnboarding()` is the single completion transition; `onboardingResumeScreen()` defines the
resume rule; `readOnboardingOutcome()` separates `unseen` from `invalid`; a session-only storage
mirror (populated only when a write actually fails) makes denied storage finishable in-session, and
the copy says the choice will not survive a reload. The language list now derives its availability
label from the generated foundation catalog, which `content:build` extended with per-pack
lessons/units/practice counts.

Test evidence: 61 unit tests across `tests/onboarding-state.test.ts`, `tests/WelcomeFlow.test.tsx`
and `tests/DailyPathDashboard.test.tsx`; **10/10** e2e in `tests/e2e/onboarding.spec.ts` on
Chromium, including refresh-mid-flow resume, the unsupported-placement alternative, and the
completion record. The spec's old Spanish expectation pinned the over-promise and was rewritten.

Gate check — the code half of Phase 1's gate (capability, completion, resumption, unsupported
placement) is met and pinned. The gate's *observed five-user pilot* is **pending**: it is a human
session and nothing in this repository can close it.

### Phase 2A — French migration pilot: evidence only

Two new test files prove the claim before any content moves:

- `tests/french-pack-migration-parity.test.ts` (8 tests) — the real French pack migrates to a pack
  `validateV2Pack` accepts; the reachable activity set, every lesson/step/prerequisite id and its
  order, the `exercisesById` identities, the retained completion lists, unit/concept/vocabulary
  sets, media urls and sha256, and the `reviewOf` retrieval links are all identical. Migration is
  deterministic, and the file fails loudly with instructions once French is no longer
  `schemaVersion: 1`.
- `tests/french-migration-replay.test.ts` (5 tests) — three histories (legacy `PracticeEvent` rows,
  post-migration `attempt`/`step-completed` rows, and a half-finished lesson) plus a format-two
  exported backup all project identically through `projectLessonEvidence` against the v1 and the
  migrated pack, with an empty quarantine list. Responses are built with the real evaluator, and
  `Evidence` carries the SRS state, so equal evidence means equal due schedules.

**The pack flip itself is deliberately not in this run.** Flipping `courses/french/manifest.json`
to v2 changes which player renders the course, so it needs the consumer and e2e-walk updates that
`docs/superpowers/plans/2026-09-10-phase-2-french-migration.md` step 3 describes, in one commit.
Landing the evidence first is what makes that commit reviewable. Exact continuation instructions
are at the end of this file.

Gate check — "existing learner histories replay without loss or inflated mastery" is proven at the
projection level. "web, offline and portable editions interpret the same pack consistently" is
**not yet verified** and belongs with the flip.


## Test evidence

Run in this worktree, macOS 26.6.2 / Node v25.9.0 / npm 11.16.0.

| Command | Result |
| --- | --- |
| `npm run content:validate` (runs inside every `content:*` command; verifies every declared media hash) | exit 0, five packs |
| `npm run content:build` ×3 before the fix | exit 0, `public/study.css` stable at 34142 bytes — masked accumulation, reproduced separately (22492 → 44879 → 67266 → 89653 bytes) |
| `npm run content:build` ×2 after the fix | exit 0, byte-identical, pinned by test |
| `npx vitest run` | **132 files passed, 1 skipped; 972 passed, 6 skipped** |
| `npx tsc --noEmit` | exit 0, no output |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (`next build --webpack`), all routes emitted |
| `python -m pytest services/voice/tests -q` | **42 passed** (contract deps only, no model environment) |
| `E2E_BASE_URL=http://localhost:3101 npx playwright test tests/e2e/onboarding.spec.ts --project=chromium --workers=1` | **10 passed** |

Full record with artifact digests: `docs/superpowers/verification/2026-09-10-phase-0-baseline.md`.
The template for future notes is `docs/superpowers/verification/RELEASE-VERIFICATION-TEMPLATE.md`.

**E2E hazard found during this run (worth fixing in the harness).** Playwright reuses any dev server
already answering on `:3100` (`reuseExistingServer: !process.env.CI`). A `next-server` from the main
tree had been listening there for three hours, so the first e2e attempt ran the spec against the
**other tree's code**: the three oldest tests passed and the four new ones failed, which reads
exactly like a broken change. Nothing in the output says which commit is being served. The run above
was redone against a dev server started from this worktree on `:3101` with `E2E_BASE_URL` set, which
also skips the config's own `webServer`.

## Commits

| Commit | Contents |
| --- | --- |
| `d8f1b55` | Phase 0A — schema-aware content reporting, regenerated reports, README/CEFR/phase-status updates, `tests/content-reporting.test.ts` |
| `0f9cbe3` | Phase 0B — `public/study.css` composed from source, reproducibility test, CI on the shipping build path, voice-service CI coverage |
| `b355e51` | Phase 1A — onboarding completion/resume/capability, generated catalog facts, updated unit + e2e specs |
| `e29fdb8` | Phase 2A evidence — French migration parity and history-replay proof |

Nothing was pushed. No merge to `main`, no tag, no deployment.

## Next tasks

1. **Phase 2A step 3 — the French flip.** See the precise instructions below. This is the next
   engineering commit and it is the highest-value one left in Phase 2.
2. **Phase 1B — the short entry sequence.** One genuinely short French and Italian opening
   (hear/see → recognise → construct → optionally say → recap), text-first and silent equivalents,
   a clear next action at the end. Then Spanish, Portuguese and German after usability checks.
3. **Phase 3A — standalone offline Listen** from the downloaded and portable entry points,
   independent of prerequisite unlocks, with persisted playback position and a cold-start/seek test.
4. **Phase 3B — audio expansion** for German/Spanish/Portuguese. Blocked on the human listening
   checklist; can be prepared but not closed here.
5. **The graphics acceptance item** (`docs/superpowers/briefs/graphics-review.md`, untracked, not
   written by this run): the German course banner on mobile. See the blockers section.

## Precise continuation instructions

### To finish Phase 2A (the French flip)

1. `npx tsx scripts/migrate-pack-v1-v2.ts courses/french/manifest.json` — deterministic; the parity
   test proves the runtime is unchanged.
2. `npm run content:build` and inspect the diff: `courses/french/manifest.json`,
   `public/packs/french.json`, `src/features/course-pack/catalog.json`,
   `docs/astra/reports/french.json`, `public/study.js`.
3. Update, in the SAME commit:
   - `tests/french-pack-migration-parity.test.ts` — it now fails on purpose with instructions; the
     stored pack is v2, so assert the stored pack's own identities and keep the replay test as the
     history proof.
   - Every suite that reads the French pack expecting the v1 engine, by moving those pins onto a
     remaining v1 pack (German, Portuguese or Spanish) — the rule the repository already uses.
   - The e2e walks that drive French lessons (`tests/e2e/course-packs.spec.ts`,
     `tests/e2e/thinking-lesson.spec.ts`, `tests/e2e/guided-session.spec.ts`,
     `tests/e2e/study-plan*.spec.ts`, `tests/e2e/offline.spec.ts`,
     `tests/e2e/helpers/complete-l0.ts`). Detect the engine by probing the grading control after
     opening the lesson (`Check` is v2, `Check answer` is the legacy player) rather than by URL.
   - `normalizePack`'s v1 path stays: old-pack import support continues through the migration
     window.
4. Run the full verification plus the Chromium e2e suite, then the portable suite
   (`npm run test:e2e:portable`), which is the edition that proves "the same pack is interpreted
   consistently". Start the dev server from the worktree on a free port and pass `E2E_BASE_URL`, or
   the suite will silently test whichever tree owns `:3100`.

### To start Phase 1B

The state machine now supports it: add the short welcome as a screen between `choice` and
completion, move `completeOnboarding()` to the end of that sequence, and extend
`onboardingResumeScreen()` with the new screen. Do not claim the two-minute first phrase in copy
until the sequence exists — the current copy deliberately does not.

## Blockers and open questions

- **Human work that cannot be closed here:** native-speaker review, the observed five-user pilot,
  the audio listening checklist, physical-device QA, and any signed/notarised distribution decision.
- **`docs/superpowers/briefs/graphics-review.md`** appeared in this worktree as an untracked file
  during the run (German course banner on mobile, plus a broader graphics pass). It is not part of
  this branch's committed work and was left untracked rather than silently absorbed. It needs
  screenshots at 320/390/430 plus desktop to separate a source-art defect from an `object-fit`/crop
  one, and its own commit.
- **Found, not fixed (out of the packages above):** German has a foundation pack and a course page
  but is absent from `progress.courses` (the travel fixture's four slugs), so it never appears in
  the dashboard's language switcher or the welcome flow. Adding it means changing the dashboard's
  course universe, which is a Phase 1B-scale change, not a Phase 1A fix.
- **Found, not fixed:** `authoredCefrTags` shows the Italian v2 pack carries no `cefr` tag on its
  lessons or concepts, while the French/German/Portuguese/Spanish v1 packs do. The metadata gap is
  now reported rather than hidden; closing it is a content edit.
