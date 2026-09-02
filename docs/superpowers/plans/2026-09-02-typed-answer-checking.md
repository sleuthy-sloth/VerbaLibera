# Typed Answer Checking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add honest, local-only typed answer checking to drill steps.

**Architecture:** A generic /translate route in the existing FastAPI voice sidecar exposes a locally installed Argos engine behind the same boundary pattern as TTS/STT. A server-only Next boundary resolves the drill, normalizes, applies exact then similarity checking, and returns a three-state verdict. GuidedSession renders a response input and verdict card on drill steps; reveal stays independent.

**Tech Stack:** FastAPI, Argos Translate (operator-installed models), Next.js App Router server routes, React 19, Vitest, Testing Library, Playwright.

**Spec:** docs/superpowers/specs/2026-09-02-typed-answer-checking-design.md

## Global Constraints

- Learner response text goes browser → Next route → localhost sidecar only; it is never logged, persisted, or transmitted to third parties. Every response carries Cache-Control: no-store.
- Argos models are operator-installed; tests inject fake engines and never download models.
- Checking never gates Reveal model answer and never claims mastery; preview-only language is preserved.
- Accents are preserved by normalization; similarity thresholds live as named constants.
- Run tests before production changes (RED), prove each new test fails for the intended missing behavior, then make it pass with the smallest implementation.

---

### Task 1: Sidecar translation route

**Files:** Modify services/voice/app.py, services/voice/service/contracts.py, services/voice/service/engines.py. Create services/voice/tests/test_translate_route.py.

**Interfaces:** TranslateEngine protocol with translate(text, source, target) -> str; ArgosTranslateEngine.from_environment() with a guarded import so absent models degrade to unavailable; TranslationServiceSettings with permitted pairs fr→en and it→en and max_text_chars 2000; POST /translate; /health gains a translation capability {"available": bool, "pairs": [...]}; create_app gains an optional translate_engine parameter so existing voice tests stay green.

- [ ] RED: pytest for validation, bounds, pair whitelist, health capability, 503 failure semantics with a fake engine.
- [ ] GREEN: smallest implementation; pytest services/voice/tests -q fully green.
- [ ] Commit "feat: add local translation to the voice sidecar".

### Task 2: Next boundary and API route

**Files:** Create src/lib/answer-checking.ts, src/app/api/answer-check/route.ts, tests/answer-checking.test.ts, tests/answer-check-route.test.ts.

**Interfaces:** checkDrillAnswer({courseSlug, contentId, drillId, response}, options) -> {verdict: 'exact'|'close'|'try_again', matchedVariant?: string, limited: boolean}; SIMILARITY_CLOSE_THRESHOLD = 0.60 named constant (content-word F1 over sidecar translations with English stop words filtered — SME-adopted recipe); route validates JSON body ≤ 2 KB with 400/503 semantics and no-store.

- [ ] RED: vitest for the normalization table, exact path, similarity via injected fetch, and unavailable fallback.
- [ ] GREEN: smallest implementation; focused vitest green.
- [ ] Commit "feat: add server-side answer checking boundary".

### Task 3: GuidedSession response UI

**Files:** Modify src/components/session/GuidedSession.tsx, src/components/session/session.module.css, tests/GuidedSession.test.tsx.

**Interfaces:** DRILL steps render a labeled input + Check my answer; verdict region aria-live="polite" with the three states and the exact sentence "Checked locally. Nothing was saved."; reveal unaffected; focus moves to the verdict after checking; unavailable copy when checking reports limited.

- [ ] RED: component tests for input placement, verdict states, reveal independence, focus, fallback copy.
- [ ] GREEN: Quiet Ink implementation; focused vitest + typecheck green.
- [ ] Commit "feat: add typed response checking to drills".

### Task 4: e2e and verification

**Files:** Modify tests/e2e/guided-session.spec.ts, README.md, docs/local-voice.md.

- [ ] e2e: exact-match verdict works without the sidecar; non-exact answers show the honest limited-checking copy.
- [ ] npm test, lint, typecheck, build, git diff --check all green.
- [ ] Commit "test: verify typed answer checking".

### Task 5: Review and publish

- [ ] Whole-branch review; open PR to main.
