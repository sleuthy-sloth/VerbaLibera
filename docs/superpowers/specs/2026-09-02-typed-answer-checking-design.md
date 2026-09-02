# Typed answer checking design

## Objective

Let learners type an answer on drill steps and receive an honest, three-state verdict — computed entirely on the learner's machine, retained nowhere, and never gating the reveal flow.

## Background

Every drill fixture already carries acceptedResponses and recallTarget. The missing pieces are the checking logic, a local translation capability for meaning-based checking of valid variants, and the response UI.

## Semantics

- Normalization (both paths): trim; collapse internal whitespace; unify curly and straight apostrophes to '; lowercase; strip trailing . ! ? and surrounding quotes. Accents are preserved and significant.
- Exact path: a normalized response equal to any normalized acceptedResponses entry or recallTarget → exact.
- Meaning path (only when the exact path misses and the local sidecar is available): translate the response and each accepted variant to English with the local Argos engine, compute content-word F1 between the response translation and each variant translation (English stop words filtered before scoring), take the best score. F1 ≥ 0.60 → close; otherwise try_again. The threshold is a named constant adopted after SME review of short-sentence behavior (plain token F1 masks noun substitutions — the exact error these drills train); a prompt-keyword pre-check remains a documented future optimization.
- Degradation: sidecar unavailable → exact path only; the UI states local checking is limited. A sidecar failure never blocks reveal.

## Verdicts

- exact — "That matches an accepted answer."
- close — "Close — compare with the accepted answer." plus the closest accepted variant.
- try_again — "Try again, or reveal the model answer."
- Every verdict card ends with: "Checked locally. Nothing was saved."

## Boundaries and privacy

- New generic route POST /translate in the existing voice sidecar: {text, source, target} → {translation}. Pairs limited to fr→en and it→en. Text bound 2,000 characters. 422 unsupported pair, 400 invalid body, 503 engine failure. Cache-Control: no-store.
- New server-only boundary src/lib/answer-checking.ts resolves the drill from the existing fixture, applies normalization, exact and similarity checking, and calls the sidecar with an injected fetch. New POST /api/answer-check with a small JSON body bound; 400 invalid, 503 unavailable, 200 verdict. no-store everywhere.
- Learner text travels browser → Next server route → localhost sidecar only. It is never logged, persisted, or sent to third parties. Argos models are operator-installed; tests inject fakes and never download models.
- Checking exists only on DRILL steps. Review and new-pattern steps keep the reveal-only flow.

## UI

- DRILL steps gain a labeled response input and a Check my answer action beside Reveal model answer. Reveal remains always available; checking never gates it.
- The verdict region is aria-live="polite", uses Quiet Ink tokens, and actions keep 44-pixel targets, visible focus, and reduced-motion safety.
- Honest fallback copy when the sidecar is unavailable: "Local checking is unavailable right now — compare with the model answer."

## Acceptance criteria

- Sidecar: fake-engine pytest covers validation, bounds, pair whitelist, capability health, and failure semantics; no model downloads.
- Boundary: normalization, exact path, thresholds, injected-fetch sidecar calls, unavailable fallback.
- Component: input only on DRILL steps; verdict states; reveal unaffected; focus continuity; fallback copy.
- e2e (no sidecar in the loop): exact match verdict works; non-exact answers show the honest limited-checking state.
- Full suite, lint, typecheck, build, and git diff --check pass.
