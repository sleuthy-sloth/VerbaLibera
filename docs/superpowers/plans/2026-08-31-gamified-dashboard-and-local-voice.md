# Gamified Dashboard and Local Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver VerbaLibera’s mobile-first Signal Pop Daily Path dashboard, practical-pattern curriculum copy, optional local Kokoro/faster-whisper voice boundary, and original PWA visual assets.

**Architecture:** Pure TypeScript services compose a short daily session and supply a read-only demonstration snapshot to a React Query dashboard. Presentational React components render that snapshot into a responsive Daily Path UI and guided-session route. An optional FastAPI sidecar owns local TTS/STT behind an injected engine interface; Next.js accesses it only through server-side code. Generated Signal Pop assets live in `public/` with provenance and are named by `manifest.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, TanStack Query, Vitest, React Testing Library, Playwright, FastAPI, Kokoro, faster-whisper, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-08-31-gamified-dashboard-and-local-voice-design.md`

## Global Constraints

- Replace user-facing Thinking Method, cognate-rule, and think-pause copy with practical patterns, drills, and response turns. Keep existing database model names stable in this plan.
- Preserve exact-concept assessment/mastery checks, UTC SM-2 rules, and separate French/Italian progress; preview XP, streaks, answer reveals, and playback never write mastery.
- The Daily Path primary action starts a bounded 8-minute session: reviews first, then one drill round, then at most one new pattern if capacity remains.
- Use gentle progress only: XP, daily goal, practice-flow streak, and completion feedback; do not add hearts, penalties, leaderboards, forced timers, or proficiency claims.
- Keep French (`en → fr`) and Italian (`en → it`) as the first two A1 course fixtures. All new lesson text and audio metadata are original.
- Treat Kokoro/faster-whisper as optional local/self-hosted services. Recording starts only after an explicit action, no raw audio/transcript is persisted by default, and every voice failure preserves touch/keyboard progression.
- Use original Signal Pop raster assets only. Do not imitate or include third-party mascots, brand artwork, logos, lesson audio, or proprietary text.
- PWA assets must include regular and maskable PNG icons, use an explicit safe zone, and cache no authenticated, mutable, or voice API response.
- All primary controls meet 44 CSS-pixel touch targets, have accessible names/focus states, and respect `prefers-reduced-motion`.
- Apply TDD: every production behavior starts with a test that is run and observed to fail before the implementation is written.

---

## File map

| Path | Responsibility |
| --- | --- |
| `src/features/progress/types.ts` | Serializable demo progress, XP, daily-goal, and course summary types. |
| `src/features/progress/demo-progress.ts` | Fixed read-only snapshot used in preview mode. |
| `src/features/session/compose-session.ts` | Pure, deterministic Daily Path session ordering and capacity policy. |
| `src/app/api/demo/progress/route.ts` | `no-store` JSON route for the preview snapshot. |
| `src/features/progress/use-demo-progress.ts` | TanStack Query read-only snapshot hook. |
| `src/components/dashboard/*` | Dashboard data boundary and presentational Daily Path cards. |
| `src/app/page.tsx`, `src/app/globals.css` | Signal Pop dashboard and responsive application tokens. |
| `src/app/learn/[courseSlug]/page.tsx`, `src/components/session/*` | Guided-session entry route and session card presentation. |
| `src/features/curriculum/{types,fixture}.ts`, `src/components/audio/*` | Practical-pattern content wording and generic response-turn audio UI. |
| `public/brand/*`, `public/illustrations/*`, `src/app/manifest.ts`, `public/sw.js` | Original generated art, install metadata, and safe static PWA caching. |
| `services/voice/*`, `src/lib/voice-service.ts`, `src/app/api/voice/*` | Optional local FastAPI service and server-only Next.js proxy. |
| `tests/*`, `services/voice/tests/*` | Unit, component, route, manifest, and Python contract coverage. |
| `docs/asset-provenance.md`, `docs/local-voice.md`, `README.md` | Asset prompts/provenance, local voice setup/privacy, and public project guide. |

### Task 1: Define practical-pattern content and deterministic Daily Path composition

**Files:**
- Create: `src/features/progress/types.ts`, `src/features/progress/demo-progress.ts`, `src/features/session/compose-session.ts`
- Modify: `src/features/curriculum/types.ts`, `src/features/curriculum/fixture.ts`, `src/components/audio/AudioPlayer.tsx`, `src/components/audio/types.ts`
- Modify: `tests/curriculum-fixture.test.ts`, `tests/AudioPlayer.test.tsx`
- Test: `tests/compose-session.test.ts`, `tests/demo-progress.test.ts`

**Interfaces:**
- Produces `composeDailySession(input: DailySessionInput): readonly SessionStep[]`.
- Produces `DemoProgressSnapshot`, a serializable object with `courses`, `selectedCourseSlug`, `xp`, `dailyGoal`, `practiceFlowDays`, `dueReviewCount`, and `session`.
- Produces generic audio names `onResponseTurnComplete` and `completeResponseTurn`; no public audio type or UI copy mentions thinking.

- [ ] **Step 1: Write failing session-composition tests**

Create `tests/compose-session.test.ts` with concrete ordering and capacity assertions:

```ts
import { composeDailySession } from '@/features/session/compose-session';

const input = {
  courseSlug: 'english-to-french',
  dueReviews: [{ id: 'review-1' }, { id: 'review-2' }],
  drillRound: { id: 'drill-1' },
  newPattern: { id: 'pattern-1' },
  maxSteps: 4,
} as const;

it('places due reviews before the drill round and admits one new pattern when capacity remains', () => {
  expect(composeDailySession(input)).toEqual([
    { id: 'review-1', kind: 'REVIEW', courseSlug: 'english-to-french' },
    { id: 'review-2', kind: 'REVIEW', courseSlug: 'english-to-french' },
    { id: 'drill-1', kind: 'DRILL', courseSlug: 'english-to-french' },
    { id: 'pattern-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french' },
  ]);
});

it('omits a new pattern when reviews and drills exhaust the session capacity', () => {
  expect(composeDailySession({ ...input, maxSteps: 3 }).map((step) => step.kind)).toEqual([
    'REVIEW', 'REVIEW', 'DRILL',
  ]);
});
```

- [ ] **Step 2: Run the new composition test and observe the missing-module failure**

Run: `npm run test -- tests/compose-session.test.ts`

Expected: FAIL because `@/features/session/compose-session` does not exist.

- [ ] **Step 3: Implement the smallest pure session policy**

Create `src/features/session/compose-session.ts`:

```ts
export type SessionStepKind = 'REVIEW' | 'DRILL' | 'NEW_PATTERN';
export type SessionCandidate = Readonly<{ id: string }>;
export type SessionStep = Readonly<{ id: string; kind: SessionStepKind; courseSlug: string }>;
export type DailySessionInput = Readonly<{
  courseSlug: string;
  dueReviews: readonly SessionCandidate[];
  drillRound: SessionCandidate | null;
  newPattern: SessionCandidate | null;
  maxSteps: number;
}>;

export function composeDailySession(input: DailySessionInput): readonly SessionStep[] {
  const steps: SessionStep[] = input.dueReviews.slice(0, input.maxSteps).map((review) => ({
    id: review.id, kind: 'REVIEW', courseSlug: input.courseSlug,
  }));
  if (steps.length < input.maxSteps && input.drillRound) {
    steps.push({ id: input.drillRound.id, kind: 'DRILL', courseSlug: input.courseSlug });
  }
  if (steps.length < input.maxSteps && input.newPattern) {
    steps.push({ id: input.newPattern.id, kind: 'NEW_PATTERN', courseSlug: input.courseSlug });
  }
  return steps;
}
```

- [ ] **Step 4: Write failing wording and snapshot tests**

Add tests proving both fixtures have original practical-pattern titles/descriptions, no fixture string includes `cognate` or `Thinking Method`, and that `demoProgress.session` is the output of `composeDailySession`. Add an audio component assertion that a response turn renders `Continue` and never renders `Think it through`.

```ts
expect(JSON.stringify(initialCourses).toLowerCase()).not.toContain('cognate');
expect(JSON.stringify(initialCourses)).not.toContain('Thinking Method');
expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
```

- [ ] **Step 5: Run the wording/snapshot tests and observe expected failures**

Run: `npm run test -- tests/curriculum-fixture.test.ts tests/demo-progress.test.ts tests/AudioPlayer.test.tsx`

Expected: FAIL because fixtures and the audio component still expose Thinking Method/cognate wording and no demo snapshot exists.

- [ ] **Step 6: Migrate fixtures and audio UI to practical patterns**

Keep `ConceptFixture` and `conceptId` internal names, but change authored French/Italian examples to original use patterns such as `French: ordering politely with “Je voudrais…”` and `Italian: ordering politely with “Vorrei…”`. Use audio transcripts and drills that practice those full sentences. In `AudioPlayer`, rename `onThinkComplete` to `onResponseTurnComplete`, `completeThinking` to `completeResponseTurn`, thinking status to `Your response turn. Continue when you are ready.`, and visible answer/finish controls to `Continue` / `Complete turn`.

Create `src/features/progress/types.ts` and `demo-progress.ts` with this exact shape:

```ts
export type DemoProgressSnapshot = Readonly<{
  selectedCourseSlug: 'english-to-french' | 'english-to-italian';
  xp: number;
  practiceFlowDays: number;
  dailyGoal: Readonly<{ completed: number; target: number }>;
  dueReviewCount: number;
  courses: readonly Readonly<{ slug: string; title: string; unitLabel: string; completionPercent: number }>[];
  session: readonly SessionStep[];
}>;
```

Set `demoProgress` to `260` XP, four practice-flow days, `4/5` completed goal steps, and a six-item review count. Derive its session with `composeDailySession`, not a duplicated array literal.

- [ ] **Step 7: Verify Task 1 behavior and static checks**

Run:

```bash
npm run test -- tests/compose-session.test.ts tests/demo-progress.test.ts tests/curriculum-fixture.test.ts tests/AudioPlayer.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit zero; existing SRS and access-policy tests remain unchanged.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/features src/components/audio tests/compose-session.test.ts tests/demo-progress.test.ts tests/curriculum-fixture.test.ts tests/AudioPlayer.test.tsx
git commit -m "feat: add daily session policy and practical patterns"
```

### Task 2: Expose the read-only demonstration progress snapshot

**Files:**
- Create: `src/app/api/demo/progress/route.ts`, `src/features/progress/use-demo-progress.ts`
- Test: `tests/demo-progress-route.test.ts`, `tests/use-demo-progress.test.tsx`

**Interfaces:**
- Produces `GET(): Response` with `Cache-Control: no-store` and the exact `DemoProgressSnapshot` JSON.
- Produces `useDemoProgress(): UseQueryResult<DemoProgressSnapshot, Error>` with a static query key of `['demo-progress']`.

- [ ] **Step 1: Write the failing route and query-hook tests**

```ts
import { GET } from '@/app/api/demo/progress/route';

it('returns a read-only no-store preview snapshot', async () => {
  const response = await GET();
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ xp: 260, dueReviewCount: 6 });
});
```

For the hook, use a test `QueryClient` with retries disabled, stub `fetch` to return the JSON snapshot, render a small consumer, and assert it renders the due count. Add a second test with a non-OK `Response` and assert the consumer renders `Unable to load your practice path.`

- [ ] **Step 2: Run the route and hook tests to establish RED**

Run: `npm run test -- tests/demo-progress-route.test.ts tests/use-demo-progress.test.tsx`

Expected: FAIL because the route and hook do not exist.

- [ ] **Step 3: Implement the route and focused query hook**

```ts
// src/app/api/demo/progress/route.ts
import { NextResponse } from 'next/server';
import { demoProgress } from '@/features/progress/demo-progress';

export function GET() {
  return NextResponse.json(demoProgress, { headers: { 'Cache-Control': 'no-store' } });
}
```

```ts
// src/features/progress/use-demo-progress.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import type { DemoProgressSnapshot } from './types';

export function useDemoProgress() {
  return useQuery({
    queryKey: ['demo-progress'],
    queryFn: async (): Promise<DemoProgressSnapshot> => {
      const response = await fetch('/api/demo/progress', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load your practice path.');
      return response.json() as Promise<DemoProgressSnapshot>;
    },
  });
}
```

- [ ] **Step 4: Verify the read-only boundary**

Run:

```bash
npm run test -- tests/demo-progress-route.test.ts tests/use-demo-progress.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit zero, and no route accepts an ID, assessment result, XP mutation, streak mutation, or review mutation.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/app/api/demo/progress src/features/progress/use-demo-progress.ts tests/demo-progress-route.test.ts tests/use-demo-progress.test.tsx
git commit -m "feat: expose read-only demo progress"
```

### Task 3: Build the responsive Signal Pop Daily Path dashboard and guided-session route

**Files:**
- Create: `src/components/dashboard/DailyPathDashboard.tsx`, `src/components/dashboard/DashboardDataBoundary.tsx`, `src/components/dashboard/dashboard.module.css`, `src/components/session/GuidedSession.tsx`, `src/components/session/session.module.css`, `src/app/learn/[courseSlug]/page.tsx`
- Modify: `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `tests/app-shell.test.tsx`
- Test: `tests/DailyPathDashboard.test.tsx`, `tests/GuidedSession.test.tsx`

**Interfaces:**
- `DailyPathDashboard({ progress }: { progress: DemoProgressSnapshot }): JSX.Element` is presentational and receives no fetch function.
- `DashboardDataBoundary(): JSX.Element` owns `useDemoProgress` loading/error/retry behavior.
- `GuidedSession({ progress, courseSlug }: { progress: DemoProgressSnapshot; courseSlug: string }): JSX.Element` renders only session steps for the selected course.

- [ ] **Step 1: Write the failing Daily Path component tests**

```tsx
render(<DailyPathDashboard progress={demoProgress} />);
expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute('href', '/learn/english-to-french');
expect(screen.getByText(/4 of 5 daily steps/i)).toBeInTheDocument();
expect(screen.getByText(/4-day practice flow/i)).toBeInTheDocument();
expect(screen.getByText(/6 reviews waiting/i)).toBeInTheDocument();
expect(screen.getByText(/preview progress/i)).toBeInTheDocument();
expect(screen.getByRole('button', { name: /switch to italian/i })).toBeInTheDocument();
```

Add tests for loading (`Preparing your practice path…`), error (`Unable to load your practice path.` plus `Try again`), and no-reviews (`You are caught up on reviews.`) states. In `GuidedSession.test.tsx`, assert reviews appear before `Drill sprint` and `New pattern` and that a course slug with no matching course renders `This course is not available in preview.`

- [ ] **Step 2: Run the component tests and observe missing-component failures**

Run: `npm run test -- tests/DailyPathDashboard.test.tsx tests/GuidedSession.test.tsx`

Expected: FAIL because dashboard/session components do not exist.

- [ ] **Step 3: Implement presentational dashboard and data boundary**

Build semantic sections with a single `h1`, `h2` headings, `dl` for XP/flow/review metrics, progress elements with `aria-valuetext`, and 44-pixel buttons. `DashboardDataBoundary` must call `useDemoProgress`, render a static skeleton before data, and call the query’s `refetch` from its retry button. Course switching is local UI state only; it changes the displayed card/link but never changes `demoProgress` or calls a mutation.

Use these labels verbatim:

```tsx
<p>Preview progress</p>
<p>4-day practice flow</p>
<Link href={`/learn/${selectedCourse.slug}`}>Continue 8-minute session</Link>
<p>{progress.dueReviewCount} reviews waiting</p>
```

Use Signal Pop tokens in `globals.css` as CSS variables (`--ink`, `--indigo`, `--coral`, `--lime`, `--cloud`), keep body background `var(--cloud)`, and add a reduced-motion media query that disables celebration transitions.

- [ ] **Step 4: Implement the guided-session route**

Make `src/app/learn/[courseSlug]/page.tsx` a Server Component that awaits `params`, validates `courseSlug` against `initialCourses`, and renders a client `GuidedSession` with the fixed preview snapshot. Do not fetch from its own API route on the server. The session surface shows the ordered session step labels, a bounded progress indicator, a keyboard/touch `Continue` action, and a completion message with gentle XP copy. It must render unavailable fixture audio honestly and not promise live speech/audio.

- [ ] **Step 5: Verify responsive/accessibility and full component behavior**

Run:

```bash
npm run test -- tests/app-shell.test.tsx tests/DailyPathDashboard.test.tsx tests/GuidedSession.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit zero. Test the rendered root/action classes at a narrow layout using component semantics; reserve pixel layout proof for Task 6 browser checks.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/app src/components/dashboard src/components/session src/app/globals.css tests/app-shell.test.tsx tests/DailyPathDashboard.test.tsx tests/GuidedSession.test.tsx
git commit -m "feat: build Signal Pop daily path dashboard"
```

### Task 4: Generate original Signal Pop visuals and package the PWA shell

**Files:**
- Create: `public/brand/verbalibera-app-icon-source.png`, `public/icons/verbalibera-192.png`, `public/icons/verbalibera-512.png`, `public/icons/verbalibera-maskable-512.png`, `public/illustrations/daily-practice.png`, `public/offline.html`, `public/sw.js`, `src/app/manifest.ts`, `src/components/pwa/PwaRegistrar.tsx`, `docs/asset-provenance.md`
- Modify: `src/app/layout.tsx`, `tests/app-shell.test.tsx`
- Test: `tests/manifest.test.ts`, `tests/pwa-registrar.test.tsx`

**Interfaces:**
- `manifest(): MetadataRoute.Manifest` names `verbalibera-192.png`, `verbalibera-512.png`, and `verbalibera-maskable-512.png` with correct dimensions/purposes.
- `PwaRegistrar(): null` registers `/sw.js` in the browser only and does nothing during SSR.

- [ ] **Step 1: Write failing manifest and registrar tests**

```ts
import manifest from '@/app/manifest';

it('declares regular and maskable original Signal Pop icons', () => {
  const appManifest = manifest();
  expect(appManifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: '/icons/verbalibera-192.png', sizes: '192x192' }),
    expect.objectContaining({ src: '/icons/verbalibera-maskable-512.png', purpose: 'maskable' }),
  ]));
});
```

For `PwaRegistrar`, stub `navigator.serviceWorker.register`, render the component, and assert it receives `/sw.js`; also delete `navigator.serviceWorker` and assert rendering does not throw.

- [ ] **Step 2: Run manifest/registrar tests and observe RED**

Run: `npm run test -- tests/manifest.test.ts tests/pwa-registrar.test.tsx`

Expected: FAIL because no manifest or registrar exists.

- [ ] **Step 3: Generate and inspect original assets with the built-in image tool**

Generate a square, text-free source image using this prompt:

```text
Use case: logo-brand
Asset type: PWA app-icon source and dashboard visual system
Primary request: an original abstract speech-wave emblem for VerbaLibera: a coral curved speech wave and a small lime motion accent inside a rounded indigo square, clean high-contrast silhouette, friendly but adult, premium mobile-app icon
Style/medium: polished contemporary raster illustration, simple geometric forms
Color palette: ink #20233D, indigo #7068FF, coral #FF765F, lime #B8F266, cloud #F8F7FF
Constraints: no text, no letters, no faces, no animals, no brand resemblance, no watermark, preserve a large safe margin around the symbol
```

Generate a separate dashboard illustration using the same palette: abstract layered speech/rhythm shapes, no people, no text, no logo. Inspect each output visually. Copy selected project-bound files into the exact `public/brand/` and `public/illustrations/` paths without overwriting unrelated files. Derive the three PNG icon sizes with a deterministic local image tool while retaining the maskable safe zone.

- [ ] **Step 4: Implement manifest, safe worker, and registrar**

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VerbaLibera', short_name: 'VerbaLibera', start_url: '/', display: 'standalone',
    background_color: '#F8F7FF', theme_color: '#7068FF',
    icons: [
      { src: '/icons/verbalibera-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/verbalibera-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/verbalibera-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

`sw.js` must cache only `/offline.html`, the three icons, and the generated illustration during install, delete only caches prefixed `verbalibera-static-` during activate, and respond to failed navigation requests with `/offline.html`. It must not intercept `/api/` requests. Render `<PwaRegistrar />` inside `RootLayout` after `QueryProvider`.

- [ ] **Step 5: Write asset provenance and verify the PWA shell**

Record each exact built-in image prompt, generation date, selected source file, derived icon paths, intended use, and “original generated asset; no third-party source” in `docs/asset-provenance.md`. Then run:

```bash
npm run test -- tests/manifest.test.ts tests/pwa-registrar.test.tsx tests/app-shell.test.tsx
npm run lint
npm run typecheck
```

Expected: all commands exit zero and the assets exist at each manifest path.

- [ ] **Step 6: Commit Task 4**

```bash
git add public src/app/manifest.ts src/app/layout.tsx src/components/pwa docs/asset-provenance.md tests/manifest.test.ts tests/pwa-registrar.test.tsx
git commit -m "feat: add Signal Pop PWA visuals"
```

### Task 5: Add the optional Kokoro/faster-whisper local voice service and Next.js boundary

**Files:**
- Create: `services/voice/app.py`, `services/voice/service/contracts.py`, `services/voice/service/engines.py`, `services/voice/requirements.txt`, `services/voice/tests/test_app.py`, `src/lib/voice-service.ts`, `src/app/api/voice/health/route.ts`, `src/app/api/voice/transcribe/route.ts`, `docs/local-voice.md`
- Test: `services/voice/tests/test_app.py`, `tests/voice-service.test.ts`, `tests/voice-routes.test.ts`

**Interfaces:**
- Python `create_app(engine: VoiceEngine): FastAPI` supports dependency-injected fakes in tests.
- `VoiceEngine.health()`, `VoiceEngine.synthesize(text, language, voice)`, and `VoiceEngine.transcribe(audio, language)` never write learner recordings to disk.
- TypeScript `getVoiceHealth()` and `transcribeVoiceResponse(formData)` are server-only functions that use `VERBALIBERA_VOICE_SERVICE_URL` and fail closed when unset.

- [ ] **Step 1: Write failing Python service contract tests**

Create a fake engine and tests with `fastapi.testclient.TestClient`:

```py
def test_transcribe_rejects_oversized_audio_without_calling_engine(client, fake_engine):
    response = client.post('/transcribe', files={'audio': ('answer.webm', b'x' * 1_000_001, 'audio/webm')}, data={'language': 'fr'})
    assert response.status_code == 413
    assert fake_engine.transcribe_calls == 0

def test_transcribe_returns_only_transient_final_text(client):
    response = client.post('/transcribe', files={'audio': ('answer.webm', b'voice', 'audio/webm')}, data={'language': 'it'})
    assert response.json() == {'status': 'ok', 'transcript': 'Vorrei un caffè.'}
```

Also test `GET /health`, an unsupported language returning 422, unsupported MIME type returning 415, and a no-speech engine result returning `{ 'status': 'no_speech' }`.

- [ ] **Step 2: Run Python tests to establish RED**

Run: `python -m pytest services/voice/tests/test_app.py -q`

Expected: FAIL because `services/voice/app.py` and the app factory do not exist. If `pytest` is absent, install dependencies only inside `services/voice/.venv` and rerun the same command.

- [ ] **Step 3: Implement the app factory and engine adapters**

Use this minimal contract:

```py
class VoiceEngine(Protocol):
    def health(self) -> dict[str, object]: ...
    def synthesize(self, text: str, language: str, voice: str) -> bytes: ...
    def transcribe(self, audio: bytes, language: str) -> str | None: ...

def create_app(engine: VoiceEngine) -> FastAPI:
    app = FastAPI()
    # POST /transcribe reads at most 1_000_000 bytes, accepts audio/webm and audio/wav,
    # and returns only status/transcript JSON.
    return app
```

The production engine loads Kokoro once for authorized authored TTS generation and initializes faster-whisper once with CPU `int8` by default. Keep model paths, model name, device, compute type, permitted languages (`fr`, `it`), and maximum bytes in environment-backed configuration. `POST /tts` must reject unpermitted voices/languages and return audio bytes without saving them; it is an operator authoring endpoint, not a browser lesson endpoint. Pin runtime/test dependencies in `services/voice/requirements.txt` and document Python-version/device requirements.

- [ ] **Step 4: Write failing server-only client and route tests**

```ts
import { getVoiceHealth } from '@/lib/voice-service';

it('fails closed when no local voice service URL is configured', async () => {
  await expect(getVoiceHealth({ serviceUrl: undefined, fetchImpl: fetch })).resolves.toEqual({ available: false });
});
```

Test the health route returns `{ available: false }` without an environment URL and that the transcribe route rejects requests without an `audio` part with a 400 response. Do not mock a cloud provider or expose the local service URL to client code.

- [ ] **Step 5: Run the TypeScript voice tests to establish RED**

Run: `npm run test -- tests/voice-service.test.ts tests/voice-routes.test.ts`

Expected: FAIL because `voice-service.ts` and voice routes do not exist.

- [ ] **Step 6: Implement the server-only Next.js adapter and routes**

`src/lib/voice-service.ts` must include `import 'server-only';`, use a dependency-injected fetch implementation for tests, cap forwarded `FormData` audio size before fetch, and convert every transport/non-OK/malformed response into `{ available: false }` or a typed `VoiceTranscriptionResult` status. The health route returns a JSON availability flag only. The transcribe route forwards short audio to the configured local service and returns transcript/status only; it must set `Cache-Control: no-store` and not log body content.

- [ ] **Step 7: Document and verify the voice boundary**

Write `docs/local-voice.md` with local start commands, the exact environment variables, one-time model download notice, CPU/CUDA choices, microphone consent behavior, no-persistence default, and the limitation that a PWA does not run Python models on a learner’s phone. Run:

```bash
python -m pytest services/voice/tests/test_app.py -q
npm run test -- tests/voice-service.test.ts tests/voice-routes.test.ts
npm run lint
npm run typecheck
```

Expected: all commands exit zero. If the environment lacks local model weights, tests use the injected fake engine and the handoff names the model smoke test as deferred rather than passing.

- [ ] **Step 8: Commit Task 5**

```bash
git add services/voice src/lib/voice-service.ts src/app/api/voice tests/voice-service.test.ts tests/voice-routes.test.ts docs/local-voice.md
git commit -m "feat: add optional local voice service"
```

### Task 6: Finish documentation and run end-to-end verification

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-08-30-verbalibera-phase-1.md`
- Create: `e2e/daily-path.spec.ts`
- Test: `e2e/daily-path.spec.ts`

**Interfaces:**
- README distinguishes preview-only progress, original generated assets, local voice boundary, unavailable fixture audio, and completed/deferred work.
- Browser test visits `/`, chooses Italian, follows the primary session route, and asserts no horizontal overflow at 390 CSS pixels.

- [ ] **Step 1: Write the failing browser acceptance test**

```ts
import { expect, test } from '@playwright/test';

test('Daily Path works on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: /continue 8-minute session/i })).toBeVisible();
  await page.getByRole('button', { name: /switch to italian/i }).click();
  await page.getByRole('link', { name: /continue 8-minute session/i }).click();
  await expect(page.getByRole('heading', { name: /today’s practice path/i })).toBeVisible();
  await expect(page.locator('body')).toEvaluate((body) => body.scrollWidth <= window.innerWidth);
});
```

- [ ] **Step 2: Run the browser test and observe the expected failure**

Run: `npm run test:e2e -- e2e/daily-path.spec.ts`

Expected: FAIL before Task 3 is complete, or skip only when the sandbox cannot bind a local browser port. Record the exact environmental blocker instead of claiming a pass.

- [ ] **Step 3: Update the public README and legacy plan status**

Add a Signal Pop dashboard section, local voice setup/prerequisites link, asset provenance link, and an honest completed/deferred feature list. In the legacy Phase 1 plan, mark only its fulfilled dashboard/PWA-documentation portions complete and add a note that this newer plan supersedes Thinking Method-specific UI work; do not retroactively alter historical task evidence.

- [ ] **Step 4: Run the complete verification set**

Run:

```bash
npm run test
npm run lint
npm run typecheck
npm run prisma:validate
npm run build
npm run test:e2e -- e2e/daily-path.spec.ts
python -m pytest services/voice/tests/test_app.py -q
git diff --check
```

Expected: every locally supported command exits zero. Document any non-code platform blocker with its command and output summary in README; do not call an unrun command passing.

- [ ] **Step 5: Commit Task 6**

```bash
git add README.md docs/superpowers/plans/2026-08-30-verbalibera-phase-1.md e2e/daily-path.spec.ts
git commit -m "docs: complete gamified dashboard handoff"
```
