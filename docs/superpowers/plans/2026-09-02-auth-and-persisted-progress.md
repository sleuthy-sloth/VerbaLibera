# Authentication and Persisted Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passkey sign-in with real, account-scoped SM-2 progress and a truthful preview mode.

**Architecture:** Passkey (WebAuthn) auth with stateless jose JWT sessions guarded by the Next 16 `proxy.ts` convention. The `DemoProgressSnapshot` contract is preserved and composed server-side from `UserProgress` rows for signed-in users. One auth-guarded review mutation applies SM-2 server-side with `ReviewLog` idempotency. A single preview/saved copy module keeps every UI claim truthful.

**Tech Stack:** Next.js 16 App Router (proxy.ts), @simplewebauthn/server + @simplewebauthn/browser, jose, Prisma 7 + PostgreSQL, React 19, Vitest, Testing Library, Playwright (virtual authenticator).

**Spec:** `docs/superpowers/specs/2026-09-02-auth-and-persisted-progress-design.md`

## Global Constraints

- Passkey-only auth; no passwords; no SMTP; no OAuth in this plan.
- Session JWT: ES256, 30-minute window, httpOnly + secure + sameSite=lax; key from operator-managed file; never committed.
- All progress mutations are auth-guarded (401 unauthenticated), body-bounded (413), schema-validated (400), and no-store.
- SM-2 is computed server-side by the existing pure scheduler; the client never sends schedule state.
- The DemoProgressSnapshot client contract does not change.
- Preview copy for signed-out visitors is byte-identical to today; all saved/preview wording flows through one shared copy module.
- Learner audio is never stored; answer-check payloads remain localhost-only.
- Tests never require real WebAuthn hardware (Playwright virtual authenticator for e2e; unit tests exercise session/mapping logic with fakes).

---

### Task 1: Schema migration and content seeding

**Files:** Modify `prisma/schema.prisma` (add Credential, ReviewLog per spec), `prisma/seed.ts` (upsert-by-natural-key with content-version guard), `tests/seed.test.ts` (create).

**Interfaces:** Credential + ReviewLog exactly per spec; seed upserts Language/Course/ConceptBlock/DrillItem by natural keys (slug, courseId+position, conceptId-drillId) from the fixtures; seed records a content version and fails loudly on drift between consecutive runs.

- [ ] RED: seed test proving idempotency across two runs and drift detection.
- [ ] GREEN: migration + seed; `prisma migrate dev` + seeded database verified.
- [ ] Commit "feat: add credential and review-log schema with versioned seeding".

### Task 2: Passkey auth core

**Files:** Create `src/lib/auth/session.ts` (server-only: issue/verify jose cookie), `src/lib/auth/webauthn.ts` (registration + authentication ceremony options/verification via @simplewebauthn/server), `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts` (ceremony begin/verify pairs), `src/app/api/auth/logout/route.ts`, `tests/auth-session.test.ts`, `tests/auth-webauthn.test.ts` (create).

**Interfaces:** session cookie name/constants; `getSessionUser()` server-only helper returning `{userId, accountLabel} | null`; ceremonies persist `Credential` rows with counter updates; registration is operator-gated (an env-set registration token) so enrollment stays operator-run.

- [ ] RED: session issue/verify/expiry tests; ceremony option/verification tests with fixture challenges; route validation tests (401/400 semantics, no-store).
- [ ] GREEN: smallest implementation; deps added: @simplewebauthn/server, jose.
- [ ] Commit "feat: add passkey auth core".

### Task 3: Session guard, CSRF, and login UI

**Files:** Create `proxy.ts` (session guard redirecting unauthenticated page reads to /login for protected paths), `src/app/login/page.tsx` + minimal Quiet Ink login UI (register + sign-in flows via @simplewebauthn/browser), `src/lib/auth/csrf.ts` (double-submit cookie helpers), modify route handlers from Task 2 to enforce CSRF, `tests/proxy-guard.test.ts`, `tests/csrf.test.ts`, `tests/LoginPage.test.tsx` (create).

**Interfaces:** proxy matcher protects mutation routes and future account pages; public routes (`/`, `/learn/*`, `/api/answer-check`, `/api/demo/progress`) stay public so preview mode is unchanged; login page keeps Quiet Ink tokens and 44px targets.

- [ ] RED: guard redirect tests; CSRF acceptance/rejection tests; login page render + ceremony trigger tests.
- [ ] GREEN: implementation; focused suites green.
- [ ] Commit "feat: add session guard, csrf, and passkey login ui".

### Task 4: Progress read model and review mutation

**Files:** Create `src/lib/progress/snapshot.ts` (server-only composition of DemoProgressSnapshot from UserProgress rows), `src/lib/progress/quality.ts` (verdict+latency → 0–5 pure mapping), `src/app/api/progress/review/route.ts`, `src/lib/progress/copy.ts` (isPreviewMode copy module), modify `src/app/api/demo/progress/route.ts` (compose per session when signed in), modify `src/components/session/GuidedSession.tsx` (submit review on drill completion when signed in; copy via module), modify `src/components/dashboard/DailyPathDashboard.tsx` (saved-vs-preview wording via module), `tests/progress-snapshot.test.ts`, `tests/progress-quality.test.ts`, `tests/progress-review-route.test.ts`, `tests/progress-copy.test.ts`, update `tests/GuidedSession.test.tsx` + `tests/DailyPathDashboard.test.tsx` copy assertions (create/modify as listed).

**Interfaces:** composition maps UserProgress rows to the snapshot fields (dueReviewCount from dueAt, dailyGoal from today's reviews, session via composeDailySession fed from due items); review route per spec with ReviewLog idempotency; copy module exports the saved/preview strings consumed by session + dashboard.

- [ ] RED: snapshot composition, quality mapping table, route validation/idempotency, copy module tests; updated component copy tests.
- [ ] GREEN: implementation; focused suites green.
- [ ] Commit "feat: add per-user progress read model and review mutation".

### Task 5: e2e and verification

**Files:** Create `tests/e2e/auth-progress.spec.ts` (virtual WebAuthn authenticator: register, sign in, complete a drill review, verify snapshot persistence across reload), modify `README.md` (accounts + data truthfulness section), modify `docs/local-voice.md` only if env vars change.

- [ ] e2e: signed-out preview unchanged (existing specs stay green); signed-in register → review → reload → due counts persist.
- [ ] npm test, lint, typecheck, build, git diff --check all green.
- [ ] Commit "test: verify auth and persisted progress".

### Task 6: Review and publish

- [ ] Whole-branch review; open PR to main.
