# Quiet Ink Interface Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Signal Pop with the responsive, editorial Quiet Ink dashboard, guided session, and static PWA shell.

**Architecture:** Global CSS and Next font variables establish Quiet Ink. The dashboard retains current progress data but reorganizes it into a generic segmented selector, primary Today card, and secondary sticky snapshot. Guided sessions replace the duplicated rail with a stepline and deliberate answer reveal, keeping truthful unavailable-audio behavior until the separate Kokoro asset work supplies clips.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, next/font/google, Vitest, Testing Library, PWA manifest.

**Spec:** `docs/superpowers/specs/2026-09-01-quiet-ink-interface-redesign.md`

## Global Constraints

- Use canvas `#f4f3ee`, surface `#ffffff`, ink `#1a1f1e`, deep ink `#0f1312`, accent `#1e6563`, strong accent `#174b4a`, and soft accent `#e4edeb`; remove coral, lime, indigo, and the radial body wash.
- Load Newsreader, Instrument Sans, and IBM Plex Mono through `next/font/google`; preserve visible `:focus-visible`, reduced-motion behavior, and teal selection styling.
- Generate course selection from `progress.courses`; never hardcode French/Italian controls or logic.
- Link the CTA only when matching curriculum and session data both exist.
- Do not render an answer before `Reveal model answer`; reset reveal state on every session-step transition.
- Keep the static service worker unchanged; never cache learner data or add offline-unit caching.
- Keep an honest unavailable-audio fallback until the separate original-Kokoro-audio work creates local clips.
- At widths of 760px and below, avoid page-level horizontal scrolling and keep the Today CTA above the fold.

---

### Task 1: Establish Quiet Ink tokens, typography, and PWA presentation

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/manifest.ts`
- Modify: `public/offline.html`
- Modify: `tests/manifest.test.ts`
- Create: `tests/quiet-ink-global-styles.test.ts`

**Interfaces:**
- Consumes: Next `MetadataRoute.Manifest` and global CSS custom properties.
- Produces: `--font-display`, `--font-body`, and `--font-utility` Quiet Ink variables used by all CSS modules.

- [ ] **Step 1: Write failing global-style and manifest tests**

```ts
it('uses approved Quiet Ink tokens and font roles', async () => {
  const css = await readFile(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
  expect(css).toContain('--canvas: #f4f3ee');
  expect(css).toContain('--accent: #1e6563');
  expect(css).not.toContain('--coral:');
  expect(css).not.toContain('radial-gradient');
  expect(css).toContain(':focus-visible');
  expect(css).toContain('prefers-reduced-motion');
});

it('describes the Quiet Ink standalone application', () => {
  expect(manifest()).toMatchObject({
    id: '/', start_url: '/', display: 'standalone',
    background_color: '#f4f3ee', theme_color: '#f4f3ee',
    description: 'A calm daily practice path for practical language patterns.',
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- --run tests/quiet-ink-global-styles.test.ts tests/manifest.test.ts`

Expected: failure because Signal Pop tokens, Geist variables, and indigo manifest colors remain.

- [ ] **Step 3: Implement the visual foundation**

Replace `Geist` imports with `Newsreader`, `Instrument_Sans`, and `IBM_Plex_Mono`; define:

```ts
const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'] });
const instrumentSans = Instrument_Sans({ variable: '--font-instrument-sans', subsets: ['latin'] });
const ibmPlexMono = IBM_Plex_Mono({ variable: '--font-ibm-plex-mono', subsets: ['latin'], weight: ['400', '500'] });
```

Attach all variables to `<html>`. In `globals.css`, define the exact constraint colors, map the three font roles, use flat `var(--canvas)` body background, recolor selection to `var(--accent)`, and retain focus/reduced-motion rules. Update `@theme inline` to the body/utility roles.

Set manifest `id`, colors, description, and exactly these shortcuts: `{ name: 'Today', url: '/' }` and `{ name: 'Resume session', url: '/learn/english-to-french' }`. Retain existing icons and do not edit `public/sw.js`. Restyle `offline.html` with canvas, surface, ink, accent, a serif fallback heading, and a thin border; remove Signal Pop inline colors.

- [ ] **Step 4: Run focused and service-worker regression tests**

Run: `npm test -- --run tests/quiet-ink-global-styles.test.ts tests/manifest.test.ts tests/service-worker.test.ts`

Expected: all pass and service-worker tests confirm unchanged static fallback behavior.

- [ ] **Step 5: Commit Task 1**

Run: `git add src/app/layout.tsx src/app/globals.css src/app/manifest.ts public/offline.html tests/quiet-ink-global-styles.test.ts tests/manifest.test.ts && git commit -m "feat: establish quiet ink visual foundation"`

### Task 2: Recompose the dashboard around the daily path

**Files:**
- Modify: `src/components/dashboard/DailyPathDashboard.tsx`
- Modify: `src/components/dashboard/dashboard.module.css`
- Modify: `tests/DailyPathDashboard.test.tsx`

**Interfaces:**
- Consumes: `DemoProgressSnapshot`, `progress.courses`, `initialCourses`, and `progress.session`.
- Produces: generic `button[aria-pressed]` course segments, `todayCard`, `dailyGoal`, and `progressPanel` structure while preserving the session-link safety rule.

- [ ] **Step 1: Write failing dashboard tests**

```tsx
it('renders generic course segments in the header', () => {
  render(<DailyPathDashboard progress={demoProgress} />);
  expect(screen.getByRole('button', { name: /english to french: a1 patterns/i })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('heading', { name: /your course lane/i })).not.toBeInTheDocument();
});

it('keeps goal and three steps in the Today card', () => {
  render(<DailyPathDashboard progress={demoProgress} />);
  const today = screen.getByRole('region', { name: /today's 8-minute path/i });
  expect(today).toHaveTextContent('Review');
  expect(today).toHaveTextContent('Drill');
  expect(today).toHaveTextContent('Pattern');
  expect(within(today).getByRole('progressbar', { name: /daily goal/i })).toBeInTheDocument();
});

it('shows the review queue once, in Progress snapshot', () => {
  render(<DailyPathDashboard progress={demoProgress} />);
  expect(screen.getAllByText(/6 reviews waiting/i)).toHaveLength(1);
});
```

- [ ] **Step 2: Run the dashboard test and confirm failure**

Run: `npm test -- --run tests/DailyPathDashboard.test.tsx`

Expected: failure because the old course lane and separate path section are still rendered.

- [ ] **Step 3: Implement the dashboard composition**

Move `progress.courses.map()` to a header `role="group"` labelled `Available courses`. Render one `courseSegment` per course, derive a compact visible label with `course.title.replace(/^English to /, '')`, retain the full title in `aria-label`, and preserve `aria-pressed` state.

Replace `sessionLaunch` plus the standalone path section with `<section className={styles.todayCard} aria-labelledby="today-title">`. It contains the `Today's 8-minute path` kicker, unit heading, course title, daily-goal progress, Review/Drill/Pattern compact rows with the first row `data-state="active"`, existing safe CTA/pending status, and `About 8 min`. Do not show the numeric review queue in the Review row.

Use `dashboardGrid` so `todayCard` is primary and `progressPanel` secondary/sticky at desktop. Preserve the decorative image in the intro. At 760px and below use one column, place Today before snapshot, give CTA full width, and confine any course-segment overflow to its own group. Remove `courseSwitcher`, `sessionLaunch`, and Signal Pop styling.

- [ ] **Step 4: Run dashboard tests and typecheck**

Run: `npm test -- --run tests/DailyPathDashboard.test.tsx && npm run typecheck`

Expected: all dashboard tests pass, including arbitrary-course and unavailable-session cases, with no TypeScript errors.

- [ ] **Step 5: Commit Task 2**

Run: `git add src/components/dashboard/DailyPathDashboard.tsx src/components/dashboard/dashboard.module.css tests/DailyPathDashboard.test.tsx && git commit -m "feat: redesign dashboard as quiet ink daily path"`

### Task 3: Simplify guided sessions and gate model answers

**Files:**
- Modify: `src/components/session/GuidedSession.tsx`
- Modify: `src/components/session/session.module.css`
- Modify: `tests/GuidedSession.test.tsx`

**Interfaces:**
- Consumes: `DemoProgressSnapshot.session`, seeded concept text/audio metadata, and `SessionStepKind` labels.
- Produces: reset-on-transition `answerRevealed: boolean`, a stepline labelled `Session progress`, and deliberate `Reveal model answer` action.

- [ ] **Step 1: Write failing guided-session tests**

```tsx
it('uses one stepline instead of a duplicated step rail', () => {
  render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
  expect(screen.getByText(/step 1 of 4 · review/i)).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: /session steps/i })).not.toBeInTheDocument();
});

it('withholds the answer until explicit reveal and resets it on advance', async () => {
  const user = userEvent.setup();
  render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
  expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /reveal model answer/i }));
  expect(screen.getByText('Je voudrais un café, s’il vous plaît.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^continue$/i }));
  expect(screen.queryByText('Je voudrais un café, s’il vous plaît.')).not.toBeInTheDocument();
});

it('keeps unavailable fixture audio honest', () => {
  render(<GuidedSession progress={demoProgress} courseSlug="english-to-french" />);
  expect(screen.getByText(/audio isn't available for this preview/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /play prompt/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run guided-session tests and confirm failure**

Run: `npm test -- --run tests/GuidedSession.test.tsx`

Expected: failure because the old rail and inline answer transcript are present.

- [ ] **Step 3: Implement the session flow**

Replace the `stepRail` navigation with `<div className={styles.stepline}>${stepLabel} · ${stepNames[activeStep.kind]}</div>` beside the existing session progress bar. Add `const [answerRevealed, setAnswerRevealed] = useState(false)` and `advanceStep()` that clears reveal state before incrementing `stepIndex`.

Render a thin-bordered active card with an accent-soft number column, title, prompt, concise `Audio isn't available for this preview yet.` note, `Reveal model answer` button, and a semantically labelled `modelAnswer` panel only after reveal. Keep the primary `Continue` button, wire it to `advanceStep`, and change completion copy to include exact sentence `Nothing was saved.`

Use Quiet Ink styles for header, stepline, card, reveal action, fallback note, primary action, unavailable state, and completion. At `max-width: 760px`, collapse to one column and make actions full width without page-level overflow.

- [ ] **Step 4: Run focused behavior and static checks**

Run: `npm test -- --run tests/GuidedSession.test.tsx tests/AudioPlayer.test.tsx && npm run lint && npm run typecheck`

Expected: session tests pass without regressing AudioPlayer’s existing contract; lint and typecheck are clean.

- [ ] **Step 5: Commit Task 3**

Run: `git add src/components/session/GuidedSession.tsx src/components/session/session.module.css tests/GuidedSession.test.tsx && git commit -m "feat: redesign guided session flow"`

### Task 4: Verify the redesigned application at desktop and mobile sizes

**Files:**
- Modify: `tests/app-shell.test.tsx` only if its expectations assert removed Signal Pop structure.
- Create: `docs/superpowers/verification/2026-09-01-quiet-ink-ui-smoke.md`

**Interfaces:**
- Consumes: Tasks 1–3 global tokens, component layouts, manifest, and existing app-shell test harness.
- Produces: repeatable desktop/mobile visual verification evidence.

- [ ] **Step 1: Add the app-shell regression assertion if the current test lacks it**

```tsx
expect(await screen.findByRole('link', { name: /continue 8-minute session/i })).toBeInTheDocument();
expect(screen.getByText(/today's 8-minute path/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the app-shell test and update only stale structure assertions**

Run: `npm test -- --run tests/app-shell.test.tsx`

Expected: pass unchanged or fail only where it names removed dashboard/session hierarchy.

- [ ] **Step 3: Run complete automated verification**

Run: `npm test -- --run && npm run lint && npm run typecheck && git diff --check`

Expected: full frontend suite, lint, typecheck, and whitespace checks pass.

- [ ] **Step 4: Perform and record visual smoke tests**

Start the app and capture `/` and `/learn/english-to-french` at 1440×1000 and 390×844. Record viewport, Today CTA position, generic selector behavior, lack of page-level horizontal overflow, stepline, answer reveal, and unavailable-audio fallback in `docs/superpowers/verification/2026-09-01-quiet-ink-ui-smoke.md`. Do not add caches, model assets, or learner data.

- [ ] **Step 5: Commit Task 4**

Run: `git add tests/app-shell.test.tsx docs/superpowers/verification/2026-09-01-quiet-ink-ui-smoke.md && git commit -m "test: verify quiet ink responsive shell"`
