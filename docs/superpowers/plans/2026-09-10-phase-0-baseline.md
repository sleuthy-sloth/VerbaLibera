# Phase 0 implementation plan — trustworthy baseline and reproducible release inputs

Date: 2026-09-10. Source: `docs/superpowers/plans/2026-09-10-development-roadmap.md` §4.
Owner: Hermes (single accountable owner for this package). Branch: `hermes/hermes-830d4bcc`.

## Scope and input/output contracts

### 0A — reconcile status and content reports

Problem: `scripts/content.ts` reports `exercises` from `lesson.legacyExercises`, which for the
Italian v2 pack is the RETAINED v1 record set (199), not what a learner actually meets (259
reachable activities, 26 of them information steps). `lessonsWithAudio` is `true` when a legacy
dictation exists, which is not the same claim as "the lesson has audio". `docs/astra/reports/*.json`
therefore understate Italian and mislabel audio coverage, and dashboards built on them would
govern expansion with wrong numbers.

**Output contract** — `docs/astra/reports/<language>.json`, one object per pack, produced by
`buildContentReport()` in `scripts/content/report.ts`:

| field | meaning | denominator |
| --- | --- | --- |
| `schemaVersion`, `version`, `status` | authored truth from the manifest | — |
| `lessons`, `units`, `concepts` | authored counts | — |
| `lessonFamilies` | authored `family` per lesson (v2 only; `null` for v1 — the v1 schema has no field and the runtime adapter's `"discovery"` default is not authored data) | — |
| `vocabulary.declared/referenced/unused` | declared entries vs entries referenced by a lesson or reachable activity | declared |
| `runtimeActivities` | distinct activity ids reachable from lesson steps (`reachable`), of which `graded` and `information`; `byKind`; `bySkill` (v2) | `reachable` |
| `legacyExercises` | retained v1 records, replayed as activities or not; `byKind` | — |
| `production` | activities whose authored `skills` include `writing`/`speaking` (v2) or `mode: production` (v1); `recognition` for the rest | graded |
| `speaking` | `self-compare` activities and the lessons that reach one | lessons |
| `listening` | audio clips in the manifest, listening activities, lessons reaching one, `lessonCoveragePercent` | lessons |
| `prerequisites` | lessons with a prerequisite plus the longest prerequisite chain | lessons |
| `review` | `nativeSpeaker`, `audioListening` — explicit `"pending"` until actually performed | — |
| `level` | `claim: "partial-A1"` with the sentence that lesson count is not CEFR evidence | — |
| `answerCoverage`, `packBytes` | mechanical integrity facts | — |

**Gate:** Italian's live activities (259) appear in its report; every metric carries its
denominator; no report claims a complete A1 syllabus from lesson count.

Files: `scripts/content/report.ts` (new), `scripts/content.ts`, `tests/content-reporting.test.ts`
(new), `docs/astra/phase-status.md`, `docs/cefr-coverage.md`, `README.md`.

### 0B — reproducible bundles and release checks

Problem 1 (CSS accumulation): `scripts/content.ts` composed `public/study.css` as
`src/features/course-pack/study.css` **+ the previous contents of `public/study.css`** — a read of
a generated artifact. It was stable in practice only because the esbuild step for
`offline-entry.tsx` happens to overwrite `public/study.css` with the bundled lesson-player CSS
first, so the "previous contents" were always freshly regenerated. If that esbuild CSS output
ever stops landing at that path (entry change, `outdir` switch, dropped CSS import), every build
prepends the source stylesheet again and the artifact grows without bound. Measured: three
consecutive `npm run content:build` runs produced an identical 34142-byte `public/study.css`
(sha256 `59becb16…`), i.e. the accumulation is currently masked, not fixed.

Fix: build with `write: false` and compose the artifact explicitly from
`src/features/course-pack/study.css` + the bundle's own CSS output. No generated file is read.

Problem 2 (CI path divergence): CI runs `npx next build` — no `prebuild`, so
`content:check-deployment-imports` and `content:build` never run there, and the webpack pin in
`package.json` `build` is bypassed. Fix: CI runs `npm run build`.

Problem 3 (missing CI coverage): the deployment-import guard and the local voice-service contract
tests have no CI step. Fix: the guard rides on `prebuild` via `npm run build`; add an explicit
voice-service step installing only `fastapi`, `uvicorn`, `python-multipart`, `httpx`, `pytest`
(the heavy engines are lazily imported — verified locally: 42 passed).

**Gate:** two successive content builds are byte-identical; no unexplained generated diff; CI
exercises the shipping build path.

Files: `scripts/content.ts`, `.github/workflows/ci.yml`, `tests/content-build-reproducibility.test.ts`
(new), `tests/ci-workflow.test.ts`.

## Regression fixtures and acceptance commands

- `npx vitest run tests/content-reporting.test.ts tests/content-build-reproducibility.test.ts tests/ci-workflow.test.ts`
- `npm run content:validate && npm run content:audio-check && npm run content:build`
- `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `/tmp/vl-voice-ci-venv3/bin/python -m pytest services/voice/tests -q` (lint means the CI
  step's dependency set, not the full model environment)

## Rollback

Both changes are additive: the report builder is new and only reachable through `scripts/content.ts`;
the CSS fix changes the composition order of an already-generated artifact. Reverting the single
commit restores the previous behaviour, and the regenerated `public/study.{js,css,html}` +
`docs/astra/reports/*.json` are reproducible from source with `npm run content:build`.

## Explicitly out of scope for Phase 0

Native-speaker review, observed usability sessions, physical-device QA, deployment, and release
tagging. Phase 7 stays unstarted.
