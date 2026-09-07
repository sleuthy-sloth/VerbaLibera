# Verification record — 2026-09-06 (Milestone A baseline)

Revision: `1280fa3` (learner-entry slice, post Codex completion review).
Scope: clean-tree verification after committing the uncommitted learner slice. No desktop (R1–R6) fixes yet — those are Milestone B.

| Check | Command | Result |
| --- | --- | --- |
| Content validation | `npm run content:validate` | exit 0 — 5 packs validated, 100% answer coverage |
| Unit suite | `npx vitest run` | exit 0 — 92 files passed, 1 skipped; 601 tests passed, 1 skipped |
| New spec | `npx vitest run tests/course-start.test.tsx` | exit 0 — 4/4 passed |
| Typecheck | `npx tsc -p tsconfig.json --noEmit` | exit 0 — review-time duplicate `.next/types` and `proxy-guard.test 2.ts` failures resolved (files gone, no ignores broadened) |
| Lint (touched files) | `npx eslint` on 17 touched/new source + test files | exit 0 — 1 warning (`no-img-element` in `CourseWorkspace`, intentional: ships outside Next for offline cold starts) |
| Lint (full) | `npm run lint` | exit 0 — 0 errors, 18 warnings (same 18 pre-existing) |
| Production build | `npm run build` | exit 0 — all routes prerendered/rendered, no errors |
| Python collect | `pytest services/voice/tests/ --collect-only` | 39 tests collected across 5 files |
| E2E list | `npx playwright test --list` | 43 tests in 16 files (listed only — full browser suite NOT re-run this pass) |

Skipped: 1 unit file / 1 test (pre-existing skip, unchanged); full E2E run, DMG install, remote-DB integration, physical-device QA (all deferred to Milestone C per the roadmap).

Stale claims corrected in this pass: German/Portuguese/Spanish are active v0.1.0 starter packs (1 lesson each), not coming-soon/zero-lesson (`phase-status.md`, `implementation-report.md` deferred list); foundation event sync is implemented (`implementation-report.md` offline/sync bullet); September 5 test counts labeled as dated records (`testing.md`, `implementation-report.md`).
