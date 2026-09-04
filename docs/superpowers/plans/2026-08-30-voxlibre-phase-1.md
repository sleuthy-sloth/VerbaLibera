# VerbaLibera Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive, installable VerbaLibera foundation with English-to-French and English-to-Italian sample courses, Prisma curriculum persistence, active-pause audio, sentence-construction SRS, and a public GitHub repository.

**Architecture:** Next.js App Router renders the application shell and client components control audio and query state. Prisma/PostgreSQL owns curriculum and future learner data; pure services implement curriculum access policy and SM-2 scheduling. Preview endpoints serve fixed fixture data only, so no anonymous visitor can create mastery or review records.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, Prisma ORM, PostgreSQL, Vitest, React Testing Library, Playwright, HTML Audio API, service worker, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-08-30-verbalibera-phase-1-design.md`

> **Status note (2026-08-31):** The [Gamified Dashboard and Local Voice Implementation Plan](docs/superpowers/plans/2026-08-31-gamified-dashboard-and-local-voice.md) supersedes this plan's Thinking Method-specific UI work. The dashboard, guided session route, PWA shell, and documentation portions described here were fulfilled by the newer plan. Historical task checkboxes and evidence below are preserved as-is and are not retroactively altered.

## Global Constraints

- The first release contains exactly two seeded A1 course shells: `en → fr` and `en → it`; no French mastery can unlock Italian drills.
- Use original text and playable original audio only; do not include recordings or transcripts that require redistribution permission.
- Playback completion and answer reveal never grant concept mastery; only a trusted future assessment path may write mastery.
- Preview data is visibly labeled and read-only. Do not expose a route that accepts a browser-selected user ID or `passed: true` as mastery evidence.
- Thinking pauses are unlimited. SRS measures sentence construction only after concept comprehension.
- Primary controls are keyboard accessible and at least 44-by-44 CSS pixels. Spacebar must not hijack editable fields or native controls.
- The PWA caches only public static fallback assets; do not cache authentication, learner data, or mutable APIs.
- Use UTC timestamps, a minimum SM-2 ease factor of 1.3, deterministic tests, and committed PostgreSQL migration constraints.
- The README must distinguish delivered Phase 1 functionality from deferred authentication, speech validation, persistence mutations, full-course content, and offline sync.

---

## File map

| Path | Responsibility |
| --- | --- |
| `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts` | Tooling, scripts, browser and unit-test configuration. |
| `prisma/schema.prisma`, `prisma/migrations/*/migration.sql`, `prisma/seed.ts` | PostgreSQL schema, database-level invariants, and the two original course fixtures. |
| `src/features/curriculum/*` | Serializable curriculum types, seed-derived fixture data, and exact-concept drill access policy. |
| `src/features/srs/*` | Pure SM-2 scheduling and sentence-construction quality conversion. |
| `src/components/audio/AudioPlayer.tsx` | Segmented audio state machine, thought pause, keyboard and lifecycle behavior. |
| `src/components/dashboard/*`, `src/app/*` | Responsive pages, demo dashboard request, and course learning presentation. |
| `src/components/pwa/*`, `src/app/manifest.ts`, `public/sw.js`, `public/offline.html` | Safe PWA registration, manifest, cache policy, and offline fallback. |
| `tests/*`, `e2e/*` | Unit, component, policy, and browser acceptance tests. |
| `README.md`, `docs/architecture.md`, `docs/voice-validation.md`, `.env.example` | Setup, architecture, security boundaries, and next-phase voice design. |

### Task 1: Bootstrap the tested Next.js application

**Files:**

- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/query-provider.tsx`
- Test: `tests/app-shell.test.tsx`

**Interfaces:**

- Produces `QueryProvider({ children: ReactNode }): JSX.Element`, used by the root layout.
- Produces npm scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `prisma:generate`, `prisma:validate`, `prisma:migrate`, and `prisma:seed`.

- [ ] **Step 1: Initialize the project and install runtime/test dependencies**

Run from the repository root:

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --use-npm --import-alias '@/*' --yes
npm install @prisma/client @tanstack/react-query
npm install -D prisma vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
npx playwright install --with-deps chromium
```

Expected: the generated application starts with `npm run dev`, `package.json` contains the added dependencies, and Playwright's Chromium browser is installed.

- [ ] **Step 2: Write the failing app-shell test**

Create `tests/app-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('identifies VerbaLibera and its two initial courses', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /VerbaLibera/i })).toBeInTheDocument();
    expect(screen.getByText(/English to French/i)).toBeInTheDocument();
    expect(screen.getByText(/English to Italian/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify the missing product shell**

Run: `npm run test -- tests/app-shell.test.tsx`

Expected: FAIL because the generated page does not render VerbaLibera and both course names.

- [ ] **Step 4: Implement the smallest accessible shell and test harness**

Implement `QueryProvider` as a client component that creates exactly one `QueryClient` via `useState`, and wrap it in `src/app/layout.tsx`. Replace the generated page with semantic `main`, `h1`, and two course cards. Configure Vitest with jsdom, the `@` alias, `src/test/setup.ts`, and `@testing-library/jest-dom/vitest`; add scripts for the interfaces above. Set `DATABASE_URL` in `.env.example` to a non-secret PostgreSQL development URL template.

```tsx
'use client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 5: Verify the shell and static checks**

Run:

```bash
npm run test -- tests/app-shell.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit zero.

- [ ] **Step 6: Commit the bootstrap**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts vitest.config.ts playwright.config.ts src tests .gitignore .env.example
git commit -m "chore: bootstrap VerbaLibera application"
```

### Task 2: Add the Prisma curriculum model, constraints, and original French/Italian fixtures

**Files:**

- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/<timestamp>_init/migration.sql`
- Create: `src/lib/prisma.ts`, `src/features/curriculum/types.ts`, `src/features/curriculum/fixture.ts`
- Test: `tests/curriculum-fixture.test.ts`

**Interfaces:**

- Produces `CEFRLevel`, `DrillKind`, `AudioSegmentType`, `AssessmentResult`, and Prisma models `User`, `Language`, `Course`, `ConceptBlock`, `DrillItem`, `UserProgress`, `AudioSegment`, `ConceptAssessment`, `ConceptMastery`.
- Produces `initialCourses: readonly CourseFixture[]`, where `CourseFixture` has `slug`, `sourceLanguageCode`, `targetLanguageCode`, `concepts`, and each concept has segments and drills.
- Produces `prisma`, a development-safe singleton `PrismaClient` available only from server modules.

- [ ] **Step 1: Write failing fixture invariants**

Create `tests/curriculum-fixture.test.ts`:

```ts
import { initialCourses } from '@/features/curriculum/fixture';

describe('initial curriculum fixtures', () => {
  it('contains separate original English-to-French and English-to-Italian A1 courses', () => {
    expect(initialCourses.map((course) => course.slug)).toEqual([
      'english-to-french',
      'english-to-italian',
    ]);
    expect(initialCourses.every((course) => course.sourceLanguageCode === 'en')).toBe(true);
    expect(initialCourses.map((course) => course.targetLanguageCode)).toEqual(['fr', 'it']);
    expect(initialCourses.every((course) => course.concepts[0]?.cefrLevel === 'A1')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the fixture test before adding curriculum data**

Run: `npm run test -- tests/curriculum-fixture.test.ts`

Expected: FAIL because `initialCourses` does not exist.

- [ ] **Step 3: Define the Prisma schema and migration**

Create required entities and these key fields:

```prisma
model UserProgress {
  id              String   @id @default(cuid())
  userId          String
  drillItemId     String
  easeFactor      Float    @default(2.5)
  intervalDays    Int      @default(0)
  repetitions     Int      @default(0)
  dueAt           DateTime
  lapseCount      Int      @default(0)
  lastReviewedAt  DateTime?
  lastQuality     Int?
  lastLatencyMs   Int?
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  drillItem       DrillItem @relation(fields: [drillItemId], references: [id], onDelete: Restrict)

  @@unique([userId, drillItemId])
  @@index([userId, dueAt])
}
```

Model `Course` with source/target language foreign keys and a unique `slug`; `ConceptBlock` with `(courseId, position)` uniqueness; `DrillItem` with one required `conceptBlockId`; `AudioSegment` with optional `conceptBlockId` and `drillItemId`; and the assessment/mastery relation described by the spec. Generate a migration, then add PostgreSQL SQL constraints for source/target inequality, nonnegative durations and intervals, ease floor, and exactly one non-null `AudioSegment` parent. Implement the concept-mastery proof rule with a `BEFORE INSERT OR UPDATE` trigger that rejects non-passing or mismatched assessment rows.

- [ ] **Step 4: Create original sample fixtures and seed transaction**

Implement two `CourseFixture` values: French uses a prompt such as “How would you make *information*?” and Italian uses the corresponding `-zione` pattern. Each concept has original text, a prompt audio segment marked `pauseAfter: true`, an answer segment, and one linked transformation drill. Use clearly marked, non-working `audioUrl` values only in data fixtures; the UI must show an unavailable-audio state unless a local original clip exists. Seed Languages `en`, `fr`, `it`, then upsert the courses and nested concepts/drills/segments in one transaction.

```ts
export const initialCourses = [
  { slug: 'english-to-french', sourceLanguageCode: 'en', targetLanguageCode: 'fr', concepts: [] },
  { slug: 'english-to-italian', sourceLanguageCode: 'en', targetLanguageCode: 'it', concepts: [] },
] as const satisfies readonly CourseFixture[];
```

- [ ] **Step 5: Validate the ORM and fixtures**

Run:

```bash
npm run prisma:format
npm run prisma:validate
npm run prisma:generate
npm run test -- tests/curriculum-fixture.test.ts
```

Expected: Prisma format, validation, generation, and the fixture test all exit zero. If a local PostgreSQL URL is unavailable, do not claim migration application; record that limitation in README verification notes.

- [ ] **Step 6: Commit persistence and fixtures**

```bash
git add prisma src/lib/prisma.ts src/features/curriculum tests/curriculum-fixture.test.ts package.json package-lock.json
git commit -m "feat: add bilingual curriculum schema and fixtures"
```

### Task 3: Implement access policy and construction SRS as pure, tested domain services

**Files:**

- Create: `src/features/curriculum/access-policy.ts`, `src/features/srs/scheduler.ts`, `src/features/srs/quality.ts`
- Test: `tests/access-policy.test.ts`, `tests/scheduler.test.ts`, `tests/quality.test.ts`

**Interfaces:**

- Produces `canAccessDrill({ drillConceptId, masteredConceptIds }): boolean`.
- Produces `scheduleReview(previous: SrsState, quality: ReviewQuality, reviewedAt: Date): SrsState`.
- Produces `qualityFromConstruction({ isAccurate, latencyMs, targetLatencyMs }): ReviewQuality`.
- `SrsState` is `{ easeFactor: number; intervalDays: number; repetitions: number; dueAt: Date; lapseCount: number; lastReviewedAt: Date; lastQuality: ReviewQuality; lastLatencyMs: number | null }`.

- [ ] **Step 1: Write access-policy failures**

Create `tests/access-policy.test.ts`:

```ts
import { canAccessDrill } from '@/features/curriculum/access-policy';

it('requires mastery of the drill’s exact concept', () => {
  expect(canAccessDrill({ drillConceptId: 'fr-cognates', masteredConceptIds: ['it-cognates'] })).toBe(false);
  expect(canAccessDrill({ drillConceptId: 'fr-cognates', masteredConceptIds: ['fr-cognates'] })).toBe(true);
});
```

- [ ] **Step 2: Write SM-2 and quality failure cases**

Create tests proving initial successful intervals of one and six days, a failed review resetting repetitions to zero and scheduling one UTC day later, a 1.3 ease floor, deterministic due dates, a fast incorrect answer producing quality 0, slower accurate responses producing lower passing quality, and missing latency never becoming `0`.

```ts
expect(qualityFromConstruction({ isAccurate: false, latencyMs: 50, targetLatencyMs: 3_000 })).toBe(0);
expect(qualityFromConstruction({ isAccurate: true, latencyMs: null, targetLatencyMs: 3_000 })).toBe(3);
```

- [ ] **Step 3: Run domain tests to establish failures**

Run:

```bash
npm run test -- tests/access-policy.test.ts tests/scheduler.test.ts tests/quality.test.ts
```

Expected: FAIL because policy and scheduler modules do not exist.

- [ ] **Step 4: Implement the pure functions**

Use exact membership for access policy. Validate finite quality 0–5, nonnegative finite latency when present, and valid previous state. Apply standard SM-2 ease adjustment, clamp it to `1.3`, use `Math.round(previous.intervalDays * newEase)` after the first two successful repetitions, and calculate `dueAt` using `reviewedAt.getTime() + intervalDays * 86_400_000`. Return new objects without mutation.

```ts
export function canAccessDrill(input: { drillConceptId: string; masteredConceptIds: readonly string[] }): boolean {
  return input.masteredConceptIds.includes(input.drillConceptId);
}
```

- [ ] **Step 5: Verify deterministic domain behavior**

Run: `npm run test -- tests/access-policy.test.ts tests/scheduler.test.ts tests/quality.test.ts`

Expected: all assertions pass.

- [ ] **Step 6: Commit domain services**

```bash
git add src/features/curriculum/access-policy.ts src/features/srs tests/access-policy.test.ts tests/scheduler.test.ts tests/quality.test.ts
git commit -m "feat: add concept access and sentence SRS services"
```

### Task 4: Build the active-pause audio player with lifecycle, keyboard, and accessibility tests

**Files:**

- Create: `src/components/audio/AudioPlayer.tsx`, `src/components/audio/types.ts`, `src/components/audio/audio-availability.ts`
- Test: `tests/AudioPlayer.test.tsx`

**Interfaces:**

- Produces `AudioSegment = { id: string; url: string; type: 'prompt' | 'answer'; pauseAfter: boolean; transcript?: string }`.
- Produces `AudioPlayer({ segments, onThinkComplete, onComplete, onError }): JSX.Element`.
- Produces `AudioPlayerHandle = { completeThinking(): void; restart(): void }` through `forwardRef`.

- [ ] **Step 1: Write active-pause component failures using a media mock**

Mock `HTMLMediaElement.prototype.play`, `pause`, and the `ended` event. Write tests that start only from a button, enter a “Think it through” state after a prompt with `pauseAfter`, remain there after fake time advances, call `onThinkComplete` exactly once on the main action, and only then play the answer.

```tsx
await user.click(screen.getByRole('button', { name: /start lesson/i }));
fireEvent.ended(mediaElement);
expect(screen.getByRole('button', { name: /play answer/i })).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /play answer/i }));
expect(onThinkComplete).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Add failure tests for boundary and accessibility behavior**

Cover normal non-pausing advancement, a final segment with `pauseAfter: true`, empty segments, an unavailable URL, rejected `play()`, repeated clicks, Spacebar continuation, Spacebar in an input, modifier keys, replacement segments, and unmount cleanup. Assert visible status/error text and a retry action where applicable.

- [ ] **Step 3: Run the component tests before implementing the player**

Run: `npm run test -- tests/AudioPlayer.test.tsx`

Expected: FAIL because `AudioPlayer` does not exist.

- [ ] **Step 4: Implement a single-owner audio state machine**

Use a single `Audio` object owned by the component. Track a monotonically increasing session token in a ref; handlers read the active token before moving state. Set the next segment only after a successful transition. The completion action is idempotent while not in thinking state. Register `keydown` on `window` only while in thinking state and reject editable targets, repeated keys, and modifier combinations.

```ts
function mayHandleSpacebar(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return event.code === 'Space' && !event.repeat && !event.metaKey && !event.ctrlKey && !event.altKey
    && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)
    && !target?.isContentEditable;
}
```

Use a `44px` minimum control size in CSS, status text with `aria-live="polite"`, an `aria-label` for every button, `preventDefault()` only when handling the permitted Spacebar event, and cleanup that pauses media, clears its source, and removes listeners. Show unavailable-audio state for fixture URLs rather than pretending they play.

- [ ] **Step 5: Verify player tests and type checks**

Run:

```bash
npm run test -- tests/AudioPlayer.test.tsx
npm run typecheck
```

Expected: all active-pause, error, keyboard, and lifecycle tests pass.

- [ ] **Step 6: Commit the player**

```bash
git add src/components/audio tests/AudioPlayer.test.tsx
git commit -m "feat: add active-pause audio player"
```

### Task 5: Build the responsive dashboard, course learning page, and read-only demo query

**Files:**

- Create: `src/app/api/demo/progress/route.ts`, `src/app/learn/[courseSlug]/page.tsx`
- Create: `src/components/dashboard/Dashboard.tsx`, `src/components/dashboard/ProgressCard.tsx`, `src/features/progress/demo-progress.ts`, `src/features/progress/use-demo-progress.ts`
- Modify: `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/Dashboard.test.tsx`, `tests/demo-progress-route.test.ts`, `e2e/home.spec.ts`

**Interfaces:**

- Produces `DemoProgress = { cefrLevel: 'A1'; conceptsMastered: number; srsQueueSize: number; isDemo: true }`.
- Produces `GET /api/demo/progress`, a public immutable endpoint returning `DemoProgress` with cache prevention.
- Produces `Dashboard({ courseSlug }: { courseSlug: string }): JSX.Element` with loading, error, empty, and demo states.

- [ ] **Step 1: Write dashboard and route tests**

Test that the dashboard announces “Demo progress”, shows loading before a deferred query resolves, offers retry on a rejected fetch, renders a no-reviews message for an empty queue, and displays the three required metrics after success. Test the route only permits `GET` and returns an explicit `isDemo: true` field.

```tsx
expect(await screen.findByText(/Demo progress/i)).toBeInTheDocument();
expect(screen.getByText(/Concepts mastered/i)).toBeInTheDocument();
expect(screen.getByText(/SRS queue/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run dashboard tests to confirm the feature is absent**

Run: `npm run test -- tests/Dashboard.test.tsx tests/demo-progress-route.test.ts`

Expected: FAIL because the dashboard and route do not exist.

- [ ] **Step 3: Implement the immutable preview boundary and responsive components**

Return a fixed per-course fixture from the route and set `Cache-Control: no-store`. Use TanStack Query to fetch it. Do not create a POST, PATCH, or identity-parameterized endpoint. Render course cards from `initialCourses`, link to `/learn/english-to-french` and `/learn/english-to-italian`, show locked drills as locked in preview, and render the audio player in the learning screen. Use mobile-first styles with a single column until a medium breakpoint and avoid viewport-fixed controls that cover content.

```ts
export async function GET(): Promise<Response> {
  return Response.json({ cefrLevel: 'A1', conceptsMastered: 0, srsQueueSize: 0, isDemo: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
```

- [ ] **Step 4: Add browser acceptance coverage**

Create Playwright tests with a phone viewport and desktop viewport. Assert no horizontal document overflow, the two courses are reachable, the start action is visible, the demo label is visible, and the learning page offers the active-pause control. Ensure the browser test starts the Next server using the project `dev` command.

- [ ] **Step 5: Verify responsive presentation**

Run:

```bash
npm run test -- tests/Dashboard.test.tsx tests/demo-progress-route.test.ts
npm run test:e2e -- e2e/home.spec.ts
```

Expected: unit/route and both viewport browser checks pass.

- [ ] **Step 6: Commit the interface**

```bash
git add src/app src/components/dashboard src/features/progress src/app/globals.css tests/Dashboard.test.tsx tests/demo-progress-route.test.ts e2e/home.spec.ts
git commit -m "feat: add responsive course dashboard"
```

### Task 6: Add safe PWA behavior, documentation, end-to-end verification, and public publication

**Files:**

- Create: `src/app/manifest.ts`, `src/components/pwa/ServiceWorkerRegistration.tsx`, `public/sw.js`, `public/offline.html`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`
- Create: `README.md`, `docs/architecture.md`, `docs/voice-validation.md`
- Modify: `src/app/layout.tsx`, `.gitignore`, `.env.example`
- Test: `tests/manifest.test.ts`, `tests/service-worker.test.ts`, `e2e/pwa.spec.ts`

**Interfaces:**

- Produces a manifest named `VerbaLibera`, `display: 'standalone'`, with regular and maskable icons.
- Produces `ServiceWorkerRegistration(): null`, registered only in browser environments.
- Produces a service worker cache named `verbalibera-static-v1`, containing only the offline fallback and public icon assets.

- [ ] **Step 1: Write failing manifest and cache-boundary tests**

Test that the manifest includes name, short name, standalone display, start URL, and maskable icon. Test the worker source includes only static paths and specifically does not match `/api/`, `Authorization`, `progress`, or arbitrary responses. Add a browser test that verifies manifest delivery and worker registration after visiting the home page.

```ts
expect(manifest.display).toBe('standalone');
expect(manifest.icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
```

- [ ] **Step 2: Run PWA tests before implementation**

Run: `npm run test -- tests/manifest.test.ts tests/service-worker.test.ts`

Expected: FAIL because manifest and worker files do not exist.

- [ ] **Step 3: Implement the manifest, static worker, and fallback**

Register only after `window` exists and only when `serviceWorker` is available. The install event precaches explicit public files. The fetch handler handles navigation requests with network first and `offline.html` on network failure; it never intercepts API routes. Use original purpose-built PNG icons, not assets copied from third parties.

```js
const STATIC_CACHE = 'verbalibera-static-v1';
const STATIC_ASSETS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
```

- [ ] **Step 4: Document setup, architecture, and next-phase voice validation**

README must give exact npm, Prisma, PostgreSQL, test, and local PWA commands; state that public GitHub publication does not deploy HTTPS; list what works with placeholder audio; and list deferred features. `docs/architecture.md` must include the folder tree and curriculum flow. `docs/voice-validation.md` must cover capability detection, user-gesture permission, final-transcript normalization, no-recording-by-default policy, response-onset timing, fallback behavior, and browser-specific verification against primary documentation before implementation.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm run prisma:validate
npm run prisma:generate
npm run test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
git status --short
```

Expected: every applicable command exits zero; record any environment-blocked PostgreSQL migration or browser dependency step honestly in README and final handoff.

- [ ] **Step 6: Commit the release candidate**

```bash
git add README.md docs src/app/manifest.ts src/components/pwa public tests e2e .gitignore .env.example
git commit -m "feat: make VerbaLibera installable and documented"
```

- [ ] **Step 7: Publish the verified repository**

Check the exact owner/repository first. If absent, create it public and push the checked-out `main` branch:

```bash
gh repo view sleuthy-sloth/VerbaLibera
gh repo create sleuthy-sloth/VerbaLibera --public --source=. --remote=origin --push
```

Expected: GitHub reports a public repository URL and `git remote -v` shows `origin`. If the repository exists, stop and inspect its owner/content before changing it.

## Plan self-review

| Spec area | Planned task |
| --- | --- |
| Next.js, React, Tailwind, TanStack Query | 1 and 5 |
| Prisma models, migrations, constraints, fixtures | 2 |
| Exact concept unlocking and no client mastery path | 3 and 5 |
| SM-2 sentence construction and recall speed | 3 |
| Active-pause audio, keyboard, lifecycle, errors | 4 |
| French and Italian original A1 shells | 2 and 5 |
| Mobile/desktop dashboard | 5 |
| PWA/offline privacy boundary | 6 |
| Voice validation next steps | 6 |
| Documentation, verification, public GitHub repository | 6 |

Self-review result: each specification area maps to an implementation task. The plan has no unresolved placeholders, and the named interfaces are produced before their consumers.
