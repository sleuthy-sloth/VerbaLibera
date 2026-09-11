# Release verification note — Phase 0 baseline (2026-09-10)

Scope: the Phase 0 delivery package only (schema-aware content reporting; reproducible bundles and
release checks). **Not a release candidate.** No deployment, no tag, no merge to `main`, no push.

## Scope

- Package: Phase 0 — trustworthy baseline and reproducible release inputs
  (`docs/superpowers/plans/2026-09-10-phase-0-baseline.md`).
- In the artifact: `scripts/content/report.ts`, `scripts/content.ts`, the regenerated
  `docs/astra/reports/*.json`, `public/study.{css,js,html}`, `src/features/course-pack/catalog.json`,
  `.github/workflows/ci.yml`, three new/extended test files, and the documentation updates.
- Deliberately NOT in it: any lesson or audio content change, any schema flip, any release tag, any
  native-speaker or listening review, any deployment.

## Identity

- Commit under test: `d8f1b5541f305f6fdffc7666e25a84ad93ae283d` (Phase 0A). The Phase 0B commit that
  follows this note touches `scripts/content.ts`, the CI workflow and tests only; it was verified to
  leave every generated artifact byte-identical.
- Branch: `hermes/hermes-830d4bcc`, base `e825dd1` from `feat/fr-it-variety`.
- Working tree at test time: clean apart from expected generated output and this note's own files.
- Package version (`package.json`): `0.3.1` — unchanged by this work.
- Editions tested: none of the shipped editions were launched. This is a source/build-level
  verification.

## Environment

- macOS 26.6.2, Node `v25.9.0`, npm `11.16.0`
- No database, no voice sidecar, no browser engine required for these commands
- Voice-service contract tests ran in a throwaway venv (`/opt/homebrew/bin/python3.11`) with only
  `fastapi==0.115.12`, `uvicorn==0.34.0`, `python-multipart==0.0.20`, `httpx==0.28.1`, `pytest==8.3.5`

## Commands and results

| Command | Result |
| --- | --- |
| `npm run content:build` ×3 (before the fix) | exit 0, `public/study.css` stable at 34142 bytes / sha256 `59becb16…` — the accumulation was masked by the esbuild overwrite, see the plan's reproduction |
| `npm run content:validate` (every command validates media hashes) | exit 0, all five packs, all declared media hashes match |
| `npm run content:build` ×2 (after the fix) | exit 0, byte-identical across runs, pinned by `tests/content-build-reproducibility.test.ts` |
| `npx vitest run` | **130 files passed, 1 skipped; 941 tests passed, 6 skipped** (47.6s) |
| `npx tsc --noEmit` | exit 0, no output |
| `npm run lint` | exit 0, 62 lines of output, no errors |
| `npm run build` | exit 0 (`next build --webpack`), all routes emitted |
| `python -m pytest services/voice/tests -q` | **42 passed**, 1 deprecation warning, 2.32s |
| `npx playwright test` | **not run** — no UI behaviour changed in Phase 0 |
| `npm run test:e2e:portable` | **not run** |
| `npm run content:audio-check` | not run separately; every `content:*` command verifies media hashes |

Coverage delta against the roadmap's review (§13: 128 files, 922 tests): +2 files, +19 tests, all
new files.

## Artifact digests

Hashed after the final build in this worktree.

| Artifact | sha256 | Bytes |
| --- | --- | --- |
| `public/study.css` | `59becb16d8506d7b609fcbcec83035f6816a90bd3c3c2018217873532cbdb191` | 34142 |
| `public/study.js` | `d74c49eb561082e389809e7a6105d22f2186a28bc0fdf5cf1cedf60f849a5b0f` | 754324 |
| `public/study.html` | `dc6084c518b6568593964ee4853ef9bf9fc20b173ecf7bbad7f75cbaede64a5f` | 495 |
| `src/features/course-pack/catalog.json` | `d284662c797deb2059fea25f637a3a8e26408efe3b9c28753b139c03bcbfb5f1` | — |
| `docs/astra/reports/italian.json` | `88a2631622eefb09fbf9c51f8a33876647c918b33302e90a107f141f9750564a` | — |

`public/study.css`, `public/study.js` and `public/study.html` are byte-identical to the values
before the Phase 0B fix, which is the evidence that the CSS composition change is
behaviour-preserving rather than a content change.

## Limitations and unverified claims

- Human listening checklist: **not performed**
- Native-speaker review: **not performed**
- Observed usability session: **not performed**
- Physical device QA: **not performed**
- Browser journeys, portable-edition run, desktop packaging and live deployment status:
  **not exercised by this package**
- Contrast over `color-mix()` values remains machine-unverifiable (axe reports those nodes as
  undetermined)
- The CI changes are verified by reading the workflow and by `tests/ci-workflow.test.ts`; **CI has
  not actually run on this branch** (the workflow triggers on `main` only, and this handoff does not
  push)

## Rollback

- `git revert` the two Phase 0 commits. The report builder is additive; the CSS fix changes the
  composition order of an already-generated artifact and is proven byte-preserving.
- Reverting does not restore anything learner-facing: no progress, identity or storage format was
  touched.
- Regenerated artifacts can be reproduced from source at any time with `npm run content:build`.
