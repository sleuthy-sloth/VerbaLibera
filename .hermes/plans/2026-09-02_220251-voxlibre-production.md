# VoxLibre Production Readiness Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Take VoxLibre from preview (“half-baked” — 10 travel patterns, 1 audio pilot, preview-only progress seams) to a production-feeling language drill product: honest demo vs. signed-in states, full original audio with provenance, reliable SRS persistence, polished Quiet Ink shell with loading/empty/error states, offline-safe PWA, and deployable CI.

**Architecture:** Keep Next.js App Router + Prisma/PostgreSQL as source of truth. All learner writes go through server-only Prisma modules gated by a trusted WebAuthn-passkey session (jose ES256, HttpOnly, CSRF-bound). Demo mode stays 100% fixture-driven and labelled preview. Learning loop stays pure where testable: `scheduleReview`/`qualityFromConstruction` pure, `getProgressSnapshot`/`composeSession` deterministic, `checkTypedAnswer` bounded. Audio/voice stays sidecar-only: Kokoro authoring at build-time → static `/public/audio`, faster-whisper at runtime → transient transcript only.

**Tech Stack:** Next 16.3 / React 19 / TypeScript 5 / Tailwind 4 + CSS Modules / TanStack Query / Prisma 7 (pg) / jose + @simplewebauthn/* / Vitest + Testing Library + Playwright / Kokoro 0.9.4 + faster-whisper (Python 3.11, local sidecar) / PWA (static sw.js + offline.html)

---

## Current Context / Assumptions

**What exists (main @476b41a):**
- Quiet Ink shell landed: `layout.tsx` fonts (Newsreader/Instrument Sans/IBM Plex Mono), `globals.css` tokens (canvas `#f4f3ee`/ink `#1a1f1e`/teal `#1e6563`), `DailyPathDashboard.tsx`, `GuidedSession.tsx`, `manifest.ts` + `offline.html` + `PwaRegistrar.tsx`.
- Curriculum: 2 courses × 5 patterns (`frenchPatterns`/`italianPatterns` in `fixture.ts`), scenario/notice/title/explanation/prompt/answer + drill (`acceptedResponses`, `SUBSTITUTION`/`TRANSFORMATION`). `unavailable://` correctly marks missing audio, but review shows `frenchOrderingPilotAudio` is the *only* real clip pair (`/audio/french-ordering/...`). Italian still 0 clips. Docs at `docs/audio-provenance/french-ordering-pilot.json` + `asset-provenance.md` set good precedent.
- Learning engine: `features/srs/scheduler.ts`, `features/srs/quality.ts`, `lib/progress/snapshot.ts`, `features/session/compose-session.ts`, `features/curriculum/access-policy.ts` all pure + tested.
- Progress: `api/demo/progress` (fixture vs. `verifySessionToken` branch), `api/progress/review` (CSRF + bounded body + idempotent `ReviewLog`), `lib/progress/copy.ts` truthfulness helpers. `prisma/schema.prisma` has `Credential`, `ReviewLog`, `ContentVersion` + User relations.
- Auth: `lib/auth/session.ts` (ES256, env PEM or ephemeral dev key), `lib/auth/webauthn.ts`, `api/auth/*`, `app/login/page.tsx`, `proxy.ts` guard. 186 Vitest tests passing, build passes, but `t` still warns “Not working yet: Auth” in some docs — copy drift.
- Voice: `services/voice/` (FastAPI sidecar, Kokoro TTS + faster-whisper STT, bounded `MAX_BODY_BYTES=1M`, `audio/webm|wav` only). `local-voice.md` is excellent.
- Gaps to production feel: sparse content (5+5), 90% audio missing, no onboarding/first-run, loading skeletons vs. spinners everywhere, no toasts/optimistic UI on review, no offline lesson caching, no content-version migration, no rate-limit/observability, no seeded demo that feels “alive”, no i18n hint, screenshots are checked in but not CI-refreshed.

**Assumptions for this plan:**
- You have Node 20+, npm, Postgres 14+ reachable via `DATABASE_URL` (or Pi homelab); Python 3.11 for voice sidecar only.
- Work from `main` (not the `codex/voxlibre-phase-1` worktree — that branch is now merged). All paths below are repo-root relative.
- Keep preview honesty invariants: demo fixture = byte-identical for anonymous users; signed-in badge says “Saved to your account”; `isPreviewMode` gate; no `progress` leaked to static cache.

---

## Phase 1 — Seal the Preview/Account Seam (truthfulness + hardening)

*Without this, every later polish leaks “demo data looks like my data” mistrust.*

### Task 1: Make the “demo vs. saved” copy a single source of truth

**Objective:** Eliminate copy drift (README vs. UI vs. `copy.ts`).

**Files:**
- Modify: `src/lib/progress/copy.ts`
- Modify: `src/components/dashboard/DailyPathDashboard.tsx:46,69-72` (badge)
- Modify: `src/components/session/GuidedSession.tsx:30, ~180` (Nothing was saved)
- Modify: `README.md:15-80` (What works/doesn't)
- Test: `tests/progress-copy.test.ts`, `tests/DailyPathDashboard.test.tsx`

**Step 1: Write failing copy-contract test**

```ts
// tests/progress-copy.test.ts
it('exposes canonical preview/saved badge copy', () => {
  expect(dashboardBadgeCopy({ isPreview: true })).toMatch(/Preview progress/i);
  expect(dashboardBadgeCopy({ isPreview: false })).toMatch(/Saved to your account/i);
  expect(sessionCompletionCopy({ isPreview: true })).toMatch(/Nothing was saved/i);
});
```

**Step 2: Run** `npm run test -- tests/progress-copy.test.ts` — expect FAIL (helper missing or mismatched strings).

**Step 3: Implement** `export const dashboardBadgeCopy` + `export const sessionCompletionCopy` in `src/lib/progress/copy.ts`; wire both components to them; update README to import phrasing verbatim.

**Step 4: Run** `npm run test -- tests/progress-copy.test.ts tests/DailyPathDashboard.test.tsx` — PASS, then `npm run lint`.

**Step 5: Commit**

```bash
git add src/lib/progress/copy.ts src/components/dashboard/DailyPathDashboard.tsx src/components/session/GuidedSession.tsx tests/progress-copy.test.ts README.md
git commit -m "feat: single-source truthfulness copy for preview vs saved"
```

### Task 2: Harden session/auth edges the current tests don’t cover

**Objective:** Close the subtle auth gaps that feel “half-baked” in production: ephemeral dev key warning, cookie `__Host-` prefix, strict `SameSite=Lax`, CSRF double-submit rotation.

**Files:**
- Modify: `src/lib/auth/session.ts:26-90` (env load + ephemeral warning)
- Modify: `src/lib/auth/csrf.ts`
- Modify: `proxy.ts`
- Modify: `src/app/api/auth/login/route.ts:90-130`, `src/app/api/auth/register/route.ts`
- Test: `tests/auth-session.test.ts`, `tests/csrf.test.ts`, `tests/proxy-guard.test.ts`

**Step 1: Add failing tests:**

```ts
it('warns and sets isEphemeral when no AUTH_JWT_* PEM is configured', async () => {
  delete process.env.AUTH_JWT_PRIVATE_KEY; delete process.env.AUTH_JWT_PUBLIC_KEY;
  const { warnings } = await import('@/lib/auth/session');
  // trigger getOrGenerateKeyPair()
  expect(warnings).toMatch(/ephemeral/i);
});
it('sets __Host-voxlibre_session with Secure+HttpOnly+SameSite=Lax', async () => {
  const res = await POST_Login(validCredential);
  expect(res.headers.get('set-cookie')).toMatch(/__Host-voxlibre_session.*Secure.*HttpOnly.*SameSite=Lax/i);
});
```

**Step 2: Run** `npm run test -- tests/auth-session.test.ts` — FAIL.

**Step 3: Implement:** prefer `AUTH_JWT_PRIVATE_KEY_PATH` file read (`/*turbopackIgnore: true*/` on the `fs.readFile` already warned by build), add `isEphemeralSession` flag exposed for UI banner in preview, set cookie as `__Host-` when `process.env.NODE_ENV==='production'`, rotate CSRF token on login.

**Step 4: Verify** `npm run test -- tests/auth-session.test.ts tests/csrf.test.ts` + `npm run typecheck`.

**Step 5: Commit** `git commit -m "security: harden session cookie + CSRF + ephemeral key warning"`

### Task 3: Give first-run a real onboarding (not an empty dashboard)

**Objective:** New visitors currently land on metrics (XP 260, 4-day flow) that look fake. Replace with an honest intro when `dueReviewCount===0` and `dailyGoal.completed===0`.

**Files:**
- Create: `src/components/dashboard/FirstRunOnboarding.tsx`
- Modify: `src/components/dashboard/DailyPathDashboard.tsx` (conditional `FirstRunOnboarding` inside `todayCard`)
- Modify: `src/components/dashboard/dashboard.module.css` (quiet-ink empty state)
- Test: `tests/DailyPathDashboard.test.tsx` (empty-state branch)

**Step 1: Failing test:**

```ts
it('shows onboarding when progress is blank', () => {
  render(<DailyPathDashboard progress={blankDemoProgress} />);
  expect(screen.getByRole('heading', { name: /Start with one useful phrase/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Start 8-minute session/i })).toBeInTheDocument();
});
```

**Step 2: Run** — FAIL.

**Step 3: Implement** `FirstRunOnboarding` (serif heading, 1-sentence explainer, primary CTA to `/learn/english-to-french`, `data-testid` for smoke). No new colors — reuse `--canvas/--ink/--accent`.

**Step 4: Pass +** Playwright smoke at 390×844: Today CTA still above fold.

**Step 5: Commit.**

---

## Phase 2 — Make the Learning Loop Feel Real (persistence + feedback)

### Task 4: Optimistic review + undo + toast (no more silent POST)

**Objective:** `POST /api/progress/review` works but UI gives no feedback; failures are silent. Add TanStack Mutation with optimistic `dueReviewCount--`, undo, and an accessible toast.

**Files:**
- Create: `src/components/ui/Toast.tsx`, `src/components/ui/toast.module.css`
- Create: `src/features/progress/use-review-mutation.ts`
- Modify: `src/components/session/GuidedSession.tsx` (wire `useReviewMutation` to “I got it / Try again” actions)
- Test: `tests/progress-review-route.test.ts` + new `tests/use-review-mutation.test.tsx`

**Step 1: Failing test** mocks fetch to delay/fail, asserts toast `role="status"` appears and optimistic count rolls back on error.

**Step 2–4: Standard TDD.** Mutation key `['progress','review']`, `onMutate` snapshots, `onError` restores, `onSuccess` invalidates `['demo','progress']`. Toast auto-dismiss 3s, respects `prefers-reduced-motion`.

**Step 5: Commit.**

### Task 5: Content versioning + non-destructive seed

**Objective:** `ContentVersion` model exists but is unused; re-seeding risks wiping `UserProgress`. Make seed idempotent and dashboard-aware.

**Files:**
- Modify: `prisma/seed.ts` (upsert `ContentVersion`, compare `version` from `package.json` or `CONTENT_VERSION` env)
- Modify: `src/lib/progress/snapshot.ts` (expose `contentVersion` to snapshot)
- Modify: `src/components/dashboard/DailyPathDashboard.tsx` (dev-only version badge when `?debug=1`)
- Test: `tests/seed.test.ts`

**Step 1: Test** that running seed twice doesn’t duplicate `ConceptBlock`/`DrillItem` and `ContentVersion.version` bumps only on fixture change.

**Step 2–5: Implement** `prisma.contentVersion.upsert`, add `prisma.$transaction` with `Restrict` deletes preserved, `npm run prisma:seed` idempotence proof in CI.

### Task 6: Midnight rollover / due-queue correctness proof

**Objective:** SRS `dueAt <= now` is UTC but dashboard has shown stale counts across TZ midnight. Prove correctness.

**Files:**
- Modify: `src/features/srs/scheduler.ts` (ensure `dueAt` uses `reviewedAt + intervalDays*86_400_000` in UTC)
- Modify: `src/lib/progress/snapshot.ts` (use `new Date().toISOString()` snapshot time, not server local)
- Test: `tests/scheduler.test.ts`, `tests/progress-snapshot.test.ts` (frozen clock + TZ edge)

**Step 1: Add** `vi.useFakeTimers({ now: new Date('2026-09-03T00:05:00Z') })` test where interval 1 day rolls at UTC midnight, not local.

**Step 2–5: TDD + commit.** No user-visible change — just confidence.

---

## Phase 3 — Complete the Content (the biggest “half-baked” signal)

### Task 7: Author the remaining Italian audio with the same Kokoro proof

**Objective:** French has 2 real WAVs; Italian has 0. Generate the 8 missing WAVs (4 prompts + 4 answers for the 4 Italian patterns beyond ordering) with `services/voice/generate_lesson_audio.py`.

**Files:**
- Modify: `services/voice/service/lesson_audio.py` (add 8 `LessonClip` entries, voices `if_sara`/`ff_siwis` per `local-voice.md`)
- Create: `public/audio/italian-*/*.wav` (8 files) + hashes in `docs/audio-provenance/italian-*.json`
- Modify: `src/features/curriculum/fixture.ts` (replace 4 `unavailable://` Italian URLs with `/audio/...`)
- Test: `tests/curriculum-fixture.test.ts` (no `unavailable://` for IT), `services/voice/tests/test_lesson_audio.py`

**Step 1: Failing test** `expect(italianSegments.every(s=>s.audioUrl.startsWith('/audio/'))).toBe(true)`.

**Step 2: Generate** (requires Python 3.11 venv per `local-voice.md`):

```bash
python3.11 -m venv services/voice/.venv
services/voice/.venv/bin/pip install -r services/voice/requirements.txt
services/voice/.venv/bin/python services/voice/generate_lesson_audio.py --output-dir public/audio
# then manually listen per docs/audio-quality-checklist.md before committing
```

**Step 3: Verify** `npm run test -- tests/curriculum-fixture.test.ts` + `ls -lh public/audio/italian-*`.

**Step 4: Commit** with `docs/audio-provenance/italian-*.json` (model `kokoro@0.9.4`, voice, text, sha256).

### Task 8: Italian + French full-pattern coverage (10 → 10 real lessons)

**Objective:** Make every drill step playable; no step should fall back to “Audio isn't available”.

**Files:**
- Modify: `src/features/curriculum/fixture.ts` (add prompt/answer transcripts for all 10 patterns already authored as text)
- Modify: `public/audio/**` (remaining 10 WAVs — 5 FR polish + 5 IT)
- Test: `tests/GuidedSession.test.tsx` (for each courseSlug, `hasUnavailableAudio` is false)

**Step 1–5: Same TDD as Task 7, but split into 2 commits (FR polish, IT). Listen-check each clip against `docs/audio-quality-checklist.md` (no clipping, natural 16kHz, <1s silence trim).**

### Task 9: Content authoring guide + clip budget

**Objective:** Prevent future contributors from shipping silent placeholders again.

**Files:**
- Create: `docs/content-authoring.md` (how to add a new pattern: fixture + lesson_audio entry + `audio-provenance` + quality checklist + PWA cache note)
- Create: `docs/audio-provenance/README.md`
- Modify: `README.md` (link authoring guide)

**Steps:** Write failing test that `docs/content-authoring.md` must mention `LESSON_CLIPS`, `Kokoro`, `sha256`, and `unavailable://` fallback rule. Then write it.

---

## Phase 4 — UX Polish That Makes It Feel Production

### Task 10: Loading skeletons + error boundaries (remove spinner purgatory)

**Objective:** `DashboardDataBoundary.tsx` currently shows generic loading; add Quiet Ink skeletons.

**Files:**
- Create: `src/components/ui/Skeleton.tsx`, `skeleton.module.css`
- Modify: `src/components/dashboard/DashboardDataBoundary.tsx` (Suspense + ErrorBoundary with retry)
- Modify: `src/app/error.tsx`, `src/app/loading.tsx` (App Router conventions)
- Test: `tests/DashboardDataBoundary.test.tsx` (loading/error/retry)

**TDD:** stub `fetch` to delay 200ms, assert `aria-busy` skeleton, then content; stub to reject, assert retry button.

### Task 11: Keyboard focus + screen-reader audit (guided session is close, not perfect)

**Objective:** GuidedSession has `shouldMoveActionFocus` logic; prove it with a11y test.

**Files:**
- Modify: `src/components/session/GuidedSession.tsx:52-95` (roving `tabIndex`, `aria-live=polite` verdict)
- Modify: `src/app/globals.css` (`:focus-visible` already there — add skip-link)
- Create: `tests/a11y-session.test.tsx` (jest-axe)
- Test: `e2e/guided-session.spec.ts` (real keyboard Tab flow)

**Steps:** Fail axe test for missing `aria-label` on reveal button → fix → Playwright at 1440 + 390.

### Task 12: Motion & empty states that respect the learner

**Objective:** No confetti, no streak-shame. Add one calm completion motion (teal check, `prefers-reduced-motion: reduce` disables it) and honest empty states.

**Files:**
- Modify: `src/components/session/session.module.css` ( `@media (prefers-reduced-motion: reduce)` guard)
- Modify: `src/app/globals.css` (already has token — add `--motion-duration` var)
- Modify: `src/components/dashboard/DailyPathDashboard.tsx` (empty review queue → “You’re caught up — one pattern tomorrow keeps the flow.”)

**TDD:** Test that completion check has `data-reduced-motion` fallback.

### Task 13: Demo “alive” seed — metrics that don’t feel fake

**Objective:** Dashboard shows `260 XP / 4-day flow / 6 reviews` — it’s fixture. Make the numbers derive from real snapshot math so they feel honest even in preview.

**Files:**
- Modify: `src/features/progress/demo-progress.ts` (compute XP/flow/due from `initialCourses` + `composeSession` instead of hardcoded)
- Test: `tests/demo-progress.test.ts` (snapshot math)

**Already mostly done in review mutation — just remove hardcodes.**

---

## Phase 5 — Offline & PWA (from “installable shell” to “works on the train”)

### Task 14: Scope the service worker correctly (the current one is safe but too shy)

**Objective:** `public/sw.js` currently caches only `offline.html` + icons — correct for privacy but means a flaky train = lost lesson. Cache lesson routes + audio with versioned `voxlibre-static-v2`.

**Files:**
- Modify: `public/sw.js` (add `/`, `/learn/*`, `/audio/**`, `/_next/static/**` to precache list; `Cache-Control: no-store` still on `/api/*`)
- Modify: `tests/service-worker.test.ts` (assert new scope + `no-store` still holds for `/api/`)
- Create: `tests/e2e/offline.spec.ts` (Playwright: go offline, reload `/`, lesson still serves; `/api/demo/progress` falls back)

**TDD:** First make test expect audio cached → fails → add to `STATIC_ASSETS` allowlist; never cache `/api/progress/*`.

### Task 15: Persist optimistic reviews offline, sync on reconnect

**Objective:** Review POST currently 401s offline. Queue it in IndexedDB and replay with `clientMutationId` idempotence.

**Files:**
- Create: `src/lib/progress/offline-queue.ts` (idb wrapper, `reviewQueue` store)
- Modify: `src/features/progress/use-review-mutation.ts` (if `navigator.onLine===false`, enqueue + toast “Will sync when you’re back online”)
- Modify: `src/app/api/progress/review/route.ts` (already idempotent — prove it)
- Test: `tests/offline-queue.test.ts` + Playwright offline replay

**TDD:** Fake offline, POST review, assert `reviewQueue` entry, go online, assert `ReviewLog` row created once even on retry.

---

## Phase 6 — Deploy & Operate (make it real, not just polished locally)

### Task 16: Deterministic CI that mirrors the developer’s “green”

**Objective:** 186 tests pass locally but CI is ad-hoc. Add GH Actions that prove the same.

**Files:**
- Create: `.github/workflows/ci.yml` (Node 20, `npm ci`, `prisma validate`, `prisma generate`, `vitest run`, `next build`, `playwright install --with-deps`, `playwright test` with `--project=chromium`)
- Modify: `package.json` (add `test:ci` if needed)
- Test: CI itself — open PR, see green.

**Steps:** Write workflow that installs `python3.11` but *does not* download Kokoro models (mock voice tests only). Cache `~/.cache/pip` + `node_modules`.

### Task 17: One-command deploy + migrations story (no “it works on my machine”)

**Objective:** `DATABASE_URL` migrations are still manual. Make deploy runnable.

**Files:**
- Create: `Dockerfile` (multi-stage: `node:20-alpine` builder + `node:20-alpine` runner, `prisma migrate deploy` entrypoint)
- Create: `.env.example` (document `VOXLIBRE_VOICE_SERVICE_URL`, `AUTH_JWT_*`, `DATABASE_URL`, `WEBAUTHN_RP_ID`)
- Modify: `README.md` (Quick start: `docker compose up` or `npm run dev` + `prisma migrate`)
- Create: `compose.yml` (app + postgres 16 + optional voice sidecar)

**Steps:** Test `docker compose up --build` locally, visit `http://localhost:3000`, run `npm run prisma:seed` inside container.

### Task 18: Observability without surveillance

**Objective:** Production needs error insight without tracking learners.

**Files:**
- Create: `src/lib/observe.ts` (tiny wrapper: `console.error` + optional `SENTRY_DSN` — no PII, no audio, no transcripts)
- Modify: `src/app/api/*` (wrap with `withObserve` try/catch that logs route + status, not body)
- Create: `docs/privacy.md` (what is / isn’t logged: only route/status/duration, never `audio`/`transcript`/`credential`)
- Test: `tests/observe.test.ts` (assert body never logged)

**TDD:** Fail test that checks `observe` was called with `transcript` → guard body logging.

---

## Files Likely to Change (index)

- `src/lib/progress/copy.ts`, `src/components/dashboard/*`, `src/components/session/*`, `src/components/ui/*`
- `src/features/progress/*`, `src/features/srs/*`, `src/features/session/*`
- `src/lib/auth/*`, `proxy.ts`, `src/app/api/**/*`
- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/*`
- `services/voice/service/lesson_audio.py`, `public/audio/**`, `docs/audio-provenance/**`
- `public/sw.js`, `public/offline.html`, `src/app/manifest.ts`
- `.github/workflows/ci.yml`, `Dockerfile`, `compose.yml`

## Tests / Validation (definition of done)

For every task, prove these before merge:
```bash
npm run prisma:validate && npm run prisma:generate
npm run lint
npm run typecheck
npm run test          # 186+ (grows to ~220 after new tasks)
npm run build         # turbopack, no LayoutProps/PageProps drift
npm run test:e2e      # chromium at 1440 and 390, offline where noted
git diff --check      # no whitespace
```

Content tasks additionally require:
```bash
python3.11 -m venv services/voice/.venv && services/voice/.venv/bin/pip install -r services/voice/requirements.txt
services/voice/.venv/bin/pytest services/voice/tests/test_lesson_audio.py -q
# human listen: each new WAV passes docs/audio-quality-checklist.md
```

PWA tasks require: install prompt appears, offline reload serves shell + lesson, `Cache Storage` shows `voxlibre-static-v2` and *no* `/api/` entries.

## Risks, Tradeoffs, Open Questions

**Risks:**
- **Kokoro model download friction** (Py 3.11 pin is real; `python3` on macOS still → 3.9). Mitigate: pin `.python-version`, document `python3.11 --version` check, make `generate_lesson_audio.py` refuse to run with wrong interpreter.
- **Audio provenance bloat** (20 WAVs × ~200KB = ~4MB in git). Acceptable for Phase 1; if >10MB, move to GH Release asset + `git lfs` — but prefer committed provenance over surprise hosting.
- **Passkey platform variance** (iOS vs. desktop). Test with WebAuthn virtual authenticator in Playwright (`tests/e2e/auth-progress.spec.ts` already does this) before claiming “auth works”.
- **Offline queue idempotence** — `ReviewLog.clientMutationId` Unique index already prevents double-apply; still test replay 3×.

**Tradeoffs:**
- **Optimistic UI vs. server truth:** Choose optimistic (feels instant) but always rollback on `401/403/500`; never update XP locally without server review confirmation — keep SRS authoritative.
- **Static SW vs. Workbox:** Keep hand-rolled `sw.js` (you already audited it to *not* cache `/api/`). Workbox would add magic you’d then need to audit for learner-data leaks.
- **Hardcoded demo XP vs. derived:** Derive — honesty > marketing.

**Open Questions (answer before coding Task 7/14):**
1. Do you want Italian voice `if_sara` or `im_riccardo` for male pattern contrast? Current `local-voice.md` defaults both to `ff_siwis`/`if_sara` — confirm before generating 10 IT WAVs.
2. `ContentVersion.version` — should it be `package.json` version bump or git SHA? Package version is simpler for seed idempotence; SHA is more precise for cache busting. Recommend package version + fixture hash.
3. Deploy target: Vercel (needs `AUTH_JWT_*` env + external Postgres) vs. self-hosted Pi (your homelab) vs. Fly.io (Docker + pg). This choice drives `compose.yml` vs. `vercel.json` — pick one for Task 17.

---

## Suggested Build Order (if you want subagent-per-task)

1 → 2 → 3 (seal honesty, 1 afternoon)  
4 → 5 → 6 (learning loop, 1 afternoon)  
7 → 8 → 9 (content completeness, 1–2 evenings + listening)  
10 → 11 → 12 → 13 (polish sprint, 1 day)  
14 → 15 (offline, ½ day)  
16 → 17 → 18 (ship, ½ day)

Each task is sized 2–5 min of focused work + review; commit per task. Use `subagent-driven-development` with spec-compliance then code-quality review gates.
