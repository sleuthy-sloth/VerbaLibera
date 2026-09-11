# Hermes — development roadmap progress

Run started 2026-09-10. Model: **deepseek-v4-flash** (as instructed; no work routed elsewhere).
Roadmap source: `docs/superpowers/plans/2026-09-10-development-roadmap.md`.
Worktree: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera/.worktrees/hermes-830d4bcc`
Branch: `hermes/hermes-830d4bcc` (base `e825dd1`, from `feat/fr-it-variety`).

This file is updated as each phase lands. "Pending" below always means *not performed*, never
"assumed fine".

## Current phase

**Phase 0 complete. Phase 2A in progress (French v1→v2 migration pilot).**

## Phase status

| Phase | State | Notes |
| --- | --- | --- |
| 0 — baseline and reproducible release inputs | **Complete** | 0A report reconciliation, 0B reproducible bundles + CI parity |
| 1 — complete the first ten minutes | Not started | 1A onboarding state machine, 1B short entry sequence. The observed five-user pilot in the gate is a human task and stays pending — it cannot be closed by this run. |
| 2 — consistent activities and progress | In progress | 2A migration pilot underway; 2B content work is a separate package |
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

## Test evidence

Run in this worktree, macOS 26.6.2 / Node v25.9.0 / npm 11.16.0.

| Command | Result |
| --- | --- |
| `npm run content:validate` (runs inside every `content:*` command; verifies every declared media hash) | exit 0, five packs |
| `npm run content:build` ×3 before the fix | exit 0, `public/study.css` stable at 34142 bytes — masked accumulation, reproduced separately (22492 → 44879 → 67266 → 89653 bytes) |
| `npm run content:build` ×2 after the fix | exit 0, byte-identical, pinned by test |
| `npx vitest run` | **130 files passed, 1 skipped; 941 tests passed, 6 skipped** (47.6s) |
| `npx tsc --noEmit` | exit 0, no output |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 (`next build --webpack`) |
| `python -m pytest services/voice/tests -q` | **42 passed** (contract deps only, no model environment) |
| `npx playwright test` | not run — Phase 0 changed no UI behaviour |

Full record with artifact digests: `docs/superpowers/verification/2026-09-10-phase-0-baseline.md`.
The template for future notes is `docs/superpowers/verification/RELEASE-VERIFICATION-TEMPLATE.md`.

## Commits

| Commit | Contents |
| --- | --- |
| `d8f1b55` | Phase 0A — schema-aware content reporting, regenerated reports, README/CEFR/phase-status updates, `tests/content-reporting.test.ts` |

(Phase 0B commit appended below once created.)


## Next tasks

1. Phase 2A: French v1→v2 migration pilot — mechanical migration first, then parity proof
   (attempts, due schedules, prerequisites, backups, sync events, unfinished lessons) before the
   migrated pack is exposed; `tests/pack-migration-parity.test.ts` is the existing anchor.
2. Phase 1A: onboarding completion/resumption rules and placement capability checks.
3. Phase 1B: the short French/Italian entry sequence, with the observed five-user pilot left
   explicitly pending.
4. Phase 3A: standalone offline Listen from downloaded and portable entry points.

## Blockers and open questions

- `docs/superpowers/briefs/graphics-review.md` appeared in this worktree as an untracked file
  during the run (German course banner responsive defect plus a broader graphics pass). It is not
  part of this branch's committed work and was left untracked. It is a candidate for the "useful
  independent work" slot once Phase 2A is underway.
- Native-speaker review, the observed usability pilot, physical-device QA, and any paid
  distribution decision all need a human owner; none can be closed here.
