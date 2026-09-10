# Warm Studio — the design migration

Date: 2026-09-10
Chosen from three sketched directions in `sketches/` (Glass Material, Broadsheet,
Warm Studio). Follows `2026-09-10-lesson-experience-tier1.md`.

---

## What "change over fully" turned out to mean

The brief was to move the app onto Warm Studio. The token swap was the easy
half. Counting the palettes in the codebase at the start:

| # | Where | What it was |
| --- | --- | --- |
| 1 | `globals.css` | Quiet Ink: `#f4f3ee` / `#1a1f1e` / `#1e6563`, Liquid Glass material |
| 2 | `features/course-pack/study.css` | its own paper/ink/muted/accent, drifted from #1 |
| 3 | `features/course-pack/lesson-player.css` | `--lp-*`, a third copy of the same values |
| 4 | `components/landing/landing.module.css` | `--paper: #fbf9f3`, `--muted: #666c66` (cool grey), old-ink rules, five soft shadows |
| 5 | `components/onboarding/welcome-flow.module.css` | **Tailwind defaults** — `#111827`, `#6b7280`, `#e5e7eb`, indigo `#4f46e5` |
| 6 | nine files | `#46534f`, a cool grey-green predating all of the above |

Plus 19 stale `var(--muted-foreground, #586360)` fallbacks that would render the
retired cool grey anywhere `globals.css` was not loaded. The first version of the
drift guard only checked two files and missed every one of these.

Only #1 was maintained. Nothing failed at any point — the app simply stopped
looking like itself in six different ways, and the screens a new learner sees
first (landing, welcome flow) were built from two of the stray palettes.

## The palette

Every value verified with contrast math, not by eye:

| Token | Value | Measured |
| --- | --- | --- |
| `--canvas` | `#fbf4e6` | warm cream ground |
| `--stock` / `--stock-2` / `--stock-3` | `#fffdf7` / `#fdf7ea` / `#f2ead7` | card, recessed, well |
| `--ink` / `--ink-deep` | `#2f2a24` / `#231e18` | 13.97:1 on stock |
| `--muted-foreground` | `#6b5f4b` | **5.70:1** canvas, **6.14:1** stock |
| `--accent` | `#a8511f` | **4.97:1** on canvas, **5.35:1** under stock text |
| `--edge` / `--edge-soft` | `#2f2a24` / `#e0d3ba` | card border / resting border |
| `--state-correct-*` | `#e9f0e2` / `#2f6b3f` | |
| `--state-attention-*` | `#f7ece7` / `#8f4b3a` | |

### Two colours from the sketch failed AA and were replaced

The sketch this identity came from — the one in `sketches/003-warm-studio/` —
used `#c2662f` for the button and `#8a7c62` for the muted label. Measured:

- `#c2662f` under stock-coloured text: **3.94:1**. AA needs 4.5 at button size
  (19px with a 600 weight is not "large text").
- `#8a7c62` on canvas: **3.73:1**.

Both were corrected before shipping — `#a8511f` and `#6b5f4b`. The sketch files
still contain the originals and are deliberately left as they were drawn, so the
correction is visible in the diff between the sketch and the system.

`--muted-ink` was also caught: the old 66% ink mix composites to `#746f66` =
**4.56:1**, passing AA by six hundredths on 12px labels. Raised to 74% (5.79:1).

## The material

Depth is **stacked paper**, and it is graded — which is the fix for the failure
in the first sketch, where the same heavy offset appeared on the prompt, the
selected answer, the feedback note and the CTA, so nothing was the peak.

```
--lift-sm: 2px 2px 0 var(--edge-soft)   /* resting controls */
--lift:    4px 4px 0 var(--edge)        /* the focus card; the primary action */
--lift-lg: 5px 5px 0 var(--edge)        /* the feedback note — the moment */
```

No `backdrop-filter`, no translucency, no gradient anywhere in `src/`. Verified
mechanically: a parser over every `box-shadow` declaration in every stylesheet
reports **zero** with a non-zero blur radius.

## What the real app surfaced that the mockups could not

Three passes over live screenshots and DOM probes after the token swap:

1. **`<audio controls>` and `<progress>` render UA shadow-DOM widgets** — flat
   translucent grey. They were the last surfaces ignoring the system, sitting in
   the middle of a lesson. Styled via vendor pseudo-elements rather than replaced,
   because the e2e suite asserts against the real `<audio>` element
   (`getByLabel('Lesson audio')`, `el.currentTime`, playback spies) — a custom
   player would have traded a colour mismatch for a broken contract. Firefox
   ignores these pseudo-elements and keeps its own control.
2. **The progress bar disagreed with its own label**: `value={step}` rendered an
   empty bar beside "Practice 1 of 7". Now `step + 1`.
3. **The "used this session" list counted English.** A `choice` is answered with
   the English meaning ("Hello."), so the first pass would list "Hello." under a
   heading promising French, and the lesson summary would say "You used N
   expressions in French". `producesTargetLanguage()` now gates it, with a test.

**One false alarm worth recording:** the vision pass reported a "soft blurred
shadow" on the dashboard card and a "Next.js-style floating badge" over the nav.
Both were wrong. The DOM reports `shadow: rgb(224,211,186) 2px 2px 0px 0px` — a
hard offset. The badge is Next 16's dev-mode indicator (no `devIndicators`
config, and the nav components render no logo). Checking computed styles settled
both in one call; a screenshot at 2x scaled down does not distinguish a 2px hard
offset from a blur.

## Verification

| Gate | Before | After |
| --- | --- | --- |
| `npx vitest run` | 823 passed | **825 passed**, 0 failed (123 files) |
| `npx playwright test` (full) | 62 passed | **62 passed**, 0 failed |
| `npx tsc --noEmit` | clean | clean |
| `npx eslint src` | 0 errors, 8 warnings | 0 errors, 8 warnings (pre-existing) |
| `npx next build` | green | green |
| `npm run a11y:audit` (20 route/viewport combos) | 0 violations | **0 violations** |
| `npx @google/design.md lint DESIGN.md` | — | 0 errors, 6 expected warnings |

The audit earned its keep: the first run after the palette swap reported
`#7e7a74` at **4.19:1** on two elements — `color-mix(in srgb, var(--ink) 62%,
transparent)` in the dashboard's scenario line and the bottom-tab labels. That
mix passed under the previous, darker ink and failed under the warm one.
Both now use `--muted-foreground`.

### Tests rewritten, not deleted

- `tests/quiet-ink-global-styles.test.ts` → `tests/warm-studio-global-styles.test.ts`.
  The old file pinned the previous identity's hexes; the new one pins Warm Studio
  and keeps the load-bearing part — that `:focus-visible`,
  `prefers-reduced-motion`, `prefers-contrast: more` and the 12px type floor
  survive any restyle. It strips comments before asserting, because the file's
  job is to name the values it forbids and `globals.css` documents why they are
  gone.
- `tests/design-tokens.test.ts` (new). Fails if any `var(--token, #hex)` fallback
  disagrees with the real token, in **every** stylesheet under `src/`, and fails
  if any retired palette value reappears. Extending it from two files to all of
  them is what caught the 19 stale fallbacks and the `#2e7d5b` accent fallback
  that the initial sweep missed.
- `tests/deployment-imports.test.ts` and `tests/desktop-packaging.test.ts` got
  explicit timeouts. They boot `npx tsx` and resolve a staged server tree in a
  tmpdir jail — seconds of subprocess work that passed at 3s isolated and timed
  out at 11s inside the full parallel suite. A 5s default there measures machine
  load, not the code.

## Not done

- **No dark mode.** Stacked paper needs a warm dark ground, not an inversion.
- **`--lp-*` indirection in `lesson-player.css`.** It now reads the shared tokens,
  but through its own alias layer. Correct and guarded; could be collapsed.
- **The brand logo mark** is still a flat grey tile that does not take the accent
  — a real asset decision, not a token change, so it was left alone.
