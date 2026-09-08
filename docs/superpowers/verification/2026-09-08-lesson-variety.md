# Lesson variety — verification report

Date: 2026-09-08. Plan: `docs/superpowers/plans/2026-09-08-lesson-variety.md` (+§0.1 decisions). Spec: `docs/superpowers/specs/2026-09-08-lesson-variety-design.md`.

## Task 1 — baseline (Hermes)

- Checkout: `/Users/spkoehl/Documents/ChatGPT/VerbaLibera`, branch `opencode/lesson-variety`, HEAD `d8456ef`, single worktree.
- `shape` work reverted, preserved at `docs/superpowers/plans/2026-09-08-shape-work-superseded.patch`. Tree clean except untracked plan/spec/patch docs.
- Baseline log: `/tmp/lesson-variety-baseline-2026-09-08.log` (typecheck + focused tests + content:validate).

### Baseline results

All green, 2026-09-08 (exit 0 on all three):

```sh
npm run typecheck  # exit 0
npm test -- tests/course-pack.test.ts tests/lesson-path.test.ts tests/portable-environment.test.ts
# Test Files  3 passed (3); Tests  35 passed (35); exit 0
npm run content:validate  # exit 0, answerCoverage 100%
```

No pre-existing failures. Full log: `/tmp/lesson-variety-baseline-2026-09-08.log`.

## Wave A — OpenCode UI inventory

PENDING — dispatched 2026-09-08, read-only (no edits). Report to be filed here on return.

## Decisions (§0.1 summary)

- V2 `family` is the single taxonomy; `shape` reverted.
- Scope: Italian + French sequences; ES/PT/DE gated (1 lesson each; German also needs TTS decision).
- New listening targets ~10-minute multi-concept tracks via the voice-sidecar workflow.
- Open: Liquid Glass preference vs Quiet Ink constraint (resolve before Task 5/10).
- FreeLingo-style assessment + multi-week plans are out of scope.
