---
version: alpha
name: VerbaLibera — Warm Studio
description: An offline-first language-learning surface built to feel like a crafted object rather than a screen. Warm cream stock, a single terracotta accent, a soft friendly serif, and depth made from HARD OFFSET SHADOWS — paper stacked on paper — instead of blur. There is no translucency, no gradient, and no `backdrop-filter` anywhere in the system. Cards are cut rather than extruded, so their corners are deliberately slightly uneven. Restraint carries the brand — no confetti, no celebratory colour at scale, no score, no streak, no progress bar that implies a grade.

colors:
  primary: "#a8511f"
  primary-strong: "#8f4318"
  primary-soft: "#f6e3cd"
  canvas: "#fbf4e6"
  stock: "#fffdf7"
  stock-2: "#fdf7ea"
  stock-3: "#f2ead7"
  ink: "#2f2a24"
  ink-deep: "#231e18"
  muted: "#6b5f4b"
  edge: "#2f2a24"
  edge-soft: "#e0d3ba"
  state-correct-fill: "#e9f0e2"
  state-correct-line: "#2f6b3f"
  state-attention-fill: "#f7ece7"
  state-attention-line: "#8f4b3a"
  state-attention-ink: "#8f4b3a"
  focus-ring: "#a8511f"

typography:
  display-lg:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: 44px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  display-md:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  display-sm:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body-lg:
    fontFamily: "Instrument Sans, Arial, sans-serif"
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  body-md:
    fontFamily: "Instrument Sans, Arial, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  body-sm:
    fontFamily: "Instrument Sans, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.12em"
  button:
    fontFamily: "Instrument Sans, Arial, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0em"

rounded:
  sm: 10px
  control: 16px
  card: 20px
  pill: 999px

spacing:
  xs: 6px
  sm: 12px
  md: 20px
  lg: 32px
  xl: 48px
  section: 64px

components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
  display-heading:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-deep}"
    typography: "{typography.display-md}"
  text-muted:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.body-sm}"
  eyebrow-label:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  link-inline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary-strong}"
    typography: "{typography.body-md}"
  card:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: 20px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.stock}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: 14px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.stock}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: 14px
    height: 48px
  text-input:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.control}"
    padding: 12px
  answer-option:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.control}"
    padding: 15px
  answer-option-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.control}"
    padding: 15px
  feedback-correct:
    backgroundColor: "{colors.state-correct-fill}"
    textColor: "{colors.state-correct-line}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: 20px
  feedback-attention:
    backgroundColor: "{colors.state-attention-fill}"
    textColor: "{colors.state-attention-ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.card}"
    padding: 20px
  session-summary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.card}"
    padding: 20px
  bottom-tab-bar:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: 66px
---

## Overview

Warm Studio is the visual language of an app that asks a beginner to look at
unfamiliar words on a phone, offline, often at night, often for eight minutes at
a time. Everything follows from that: high legibility, low glare, no urgency,
and a surface that feels like something a person made.

Three commitments define it.

**Warm, not clinical.** The ground is `#fbf4e6` — warm cream, not `#f5f5f5`.
Text is `#2f2a24` — a warm near-black, not pure black. Every neutral in the
system has yellow in it.

**Depth is stacked paper, not light.** A card is a piece of stock with a solid
ink edge and a hard offset shadow, as if placed on the page. There is **no
`backdrop-filter` anywhere in the system, no translucency, and no gradient**.
This is the deliberate opposite of the frosted-glass direction it replaces, and
it is also cheaper: nothing here needs GPU compositing, which matters for a PWA
that has to work on a cheap phone.

**One accent, used sparingly.** A deep terracotta (`#a8511f`) is the only
saturated colour, and it appears on primary actions, focus rings, the active
selection, and the underline in a cloze. When a screen has two terracotta
elements, one is almost certainly wrong.

### What the system deliberately does not have

- **No blur, no transparency, no gradients.** Not on buttons, not on cards, not
  on the nav bar. A surface is a solid colour.
- **No soft shadows.** Every shadow is a hard offset with a zero blur radius.
  A blurred shadow is a different design language.
- **No celebratory colour.** Feedback uses the muted states in
  `{component.feedback-correct}` and `{component.feedback-attention}`, which tint
  the stock rather than shouting.
- **No score, streak, or XP colour.** The product promises no streak anxiety.
- **No dark mode.** Not by inverting this palette — stacked paper needs a warm
  dark counterpart, not `#000`.

## Colors

- **Canvas (`#fbf4e6`)** — Warm cream. The ground of every page.
- **Stock (`#fffdf7`)** — The card stock. Warm off-white, never `#ffffff`.
  `stock-2` (`#fdf7ea`) is the recessed stock for workbenches and cloze lines;
  `stock-3` (`#f2ead7`) is the deepest, for wells and inert chips.
- **Ink (`#2f2a24`)** — Primary text, and the colour of every card edge.
- **Ink Deep (`#231e18`)** — The highest-contrast display text.
- **Muted (`#6b5f4b`)** — Secondary text and the 12px uppercase labels. Measured
  **5.70:1** on canvas and **6.14:1** on stock. The palette this was sketched
  with used `#8a7c62`, which measures **3.73:1** on canvas and fails AA — do not
  go back to it.
- **Primary (`#a8511f`)** — The single interactive colour. Chosen for contrast,
  not for warmth alone: it holds **4.97:1** as text on canvas and **5.35:1**
  under white text. The `#c2662f` this started as measures 3.94:1 under white
  text and fails AA at button size.
- **Primary Strong (`#8f4318`)** — The pressed/hover state.
- **Primary Soft (`#f6e3cd`)** — Primary at wash strength, for the selected
  answer.
- **Edge (`#2f2a24`)** — The solid card border. **1.5px**, not 1px: the edge is
  part of how depth is drawn, and a hairline reads as a border rather than as
  cut stock. `edge-soft` (`#e0d3ba`) is the resting state for unselected
  controls and inner rules.
- **State correct (`#e9f0e2` fill, `#2f6b3f` line and text)** — A right answer.
- **State attention (`#f7ece7` fill, `#8f4b3a` line and text)** — A wrong answer
  or a near miss. Warm brick, never alarm red.

State colour is always a **redundant** cue. The headline already says whether the
answer was right; the tint exists so a learner skimming a phone gets the same
answer at a glance. Never encode the outcome in colour alone.

## Typography

Three families, three jobs, no overlap.

- **Fraunces** (`{typography.display-*}`) — a soft, slightly quirky serif for
  headlines, lesson titles, the prompt, and the end-of-session phrase list. This
  is the voice of the app: warmer than the Newsreader it replaced, and it keeps
  a hint of hand-cut irregularity that matches the card shapes.
- **Instrument Sans** (`{typography.body-*}`) — everything a learner reads: body
  copy, prompts, buttons, navigation.
- **IBM Plex Mono** (`{typography.label}`) — uppercase eyebrows, metadata, skip
  links, 0.12em tracking. Small, technical, never for prose.

**Type floor: 12px (0.75rem).** Nothing readable may be smaller.
`tests/type-scale.test.ts` enforces it across every stylesheet. This matters
especially for the tracked uppercase labels, which are 12px and weight 700 —
a first pass at 10–11px over a coloured field failed comfort even at full size.

Font stacks always carry a fallback, because the offline/portable bundle ships
`study.css` and `lesson-player.css` without `globals.css`:
`var(--font-body, Arial, Helvetica, sans-serif)`.

## Layout

- Content column maxes at **1000px** on the lesson surface, centred.
- Page padding is fluid: `clamp(20px, 5vw, 64px)`.
- Mobile leaves **84px + safe-area** at the bottom for the floating tab capsule.
- Vertical rhythm is generous. A lesson is read, not scanned.
- Prose measures stay near **55–65 characters**.

## Elevation & Depth

Depth is **stacked paper**: a solid edge plus a hard offset shadow. Expressed
once as tokens in `src/app/globals.css` and consumed everywhere:

```
--edge:      #2f2a24      /* the card border, 1.5px */
--edge-soft: #e0d3ba      /* resting controls, inner rules */
--lift-sm:   2px 2px 0 var(--edge-soft)
--lift:      4px 4px 0 var(--edge)
--lift-lg:   5px 5px 0 var(--edge)
```

**Depth is graded, and the grade carries meaning.** An earlier pass stamped the
same heavy offset on the prompt, the selected answer, the feedback note and the
CTA, and the result was that nothing was the peak of the screen. The rule now:

| Weight | Used for |
| --- | --- |
| `--lift-sm` (2px, soft edge) | resting controls — unselected answers, chips, tabs |
| `--lift` (4px, ink) | the card that is the focus of the screen; the primary action |
| `--lift-lg` (5px, ink) | the **feedback note**, which is the moment the learner cares about |

Every shadow has a **zero blur radius**. A blurred shadow belongs to the glass
language this replaced. Components must consume the tokens — never re-type the
recipe, which is how three palettes happened (see Known Gaps).

Panels do not stack more than two deep, and nothing sits under a panel.

## Shapes

- `{rounded.sm}` 10px — inputs inside a panel.
- `{rounded.control}` 16px — buttons, answer rows, chips.
- `{rounded.card}` 20px — the default for panels and cards.
- `--radius-hand` (`22px 24px 20px 26px`) — **lesson cards only.** A four-value
  radius is *slightly* uneven on purpose, so a card looks cut rather than
  extruded. It is kept as a separate token because a four-value radius cannot be
  used in a single-corner context like `border-radius: 0 var(--x) var(--x) 0`.
- `{rounded.pill}` 999px — the bottom tab capsule, chips, word-bank tokens.

## Components

**`button-primary`** — Solid `{colors.primary}`, stock-coloured text, 48px tall,
`{rounded.control}`, `--lift-sm`. Used once per screen. A screen with two
terracotta buttons has no primary action.

**`button-secondary`** — Stock background, ink text, 1.5px `{colors.edge}`,
`--lift-sm`. Everything else.

**`text-input`** — Stock, `{rounded.control}`, 1.5px `{colors.edge-soft}`. Focus
is a 4px terracotta ring via `:focus-visible`; focus is never removed, only
restyled.

**`answer-option`** / **`answer-option-selected`** — Resting state is stock with
a soft edge and `--lift-sm`; selected is `{colors.primary-soft}` with the edge
promoted to `{colors.edge}` and the offset to ink. Selection is legible without
colour: the offset and the edge both change.

**`feedback-correct`** / **`feedback-attention`** — The practice feedback note.
Lighter stock, the state tokens, `--radius-hand`, and `--lift-lg` so it is the
peak of the screen. The panel's `<strong>` headline is authored prose ("That's
it." / "Almost — the accents are off."), never a grader's category.
`features/course-pack/feedback.ts` is the only module that decides this wording,
and `tests/exercise-feedback.test.tsx` fails if taxonomy reaches the screen.

**`bottom-tab-bar`** — Floating capsule on mobile only, 66px, hidden at ≥768px
where the app uses the top navigation instead. It must never be the only
navigation on a desktop viewport.

## Do's and Don'ts

**Do**

- Put every new surface on the tokens. If a design needs a colour that is not in
  this file, add it here first, then in `globals.css`.
- Keep the accent for one thing per screen.
- Give text a fallback stack; the portable bundle has no font loader, and
  `tests/design-tokens.test.ts` asserts the fallback equals the real token.
- Grade the depth: only one element per screen should carry the heaviest offset.
- Let a correct answer be acknowledged in words. Warm and specific beats
  celebratory.

**Don't**

- Don't add `backdrop-filter`, a translucent fill, or a gradient. This identity
  has none, and `tests/design-tokens.test.ts` fails on the retired glass tokens.
- Don't use a blurred shadow. Every offset has a zero blur radius.
- Don't reintroduce `#c2662f` (3.94:1 under white text) or `#8a7c62` (3.73:1 on
  canvas). Both were in the sketch this identity came from and both fail AA.
- Don't hard-code `Arial` or `Georgia` on a surface. Use the font tokens.
- Don't render a grader's category, an error taxonomy name, or a storage verb
  ("Save and continue") to a learner.
- Don't use colour as the only signal of an outcome.
- Don't add a score, streak, or XP colour.

## Responsive Behavior

- **Breakpoint: 768px.** Below it the floating tab capsule carries navigation and
  the top nav is hidden; at and above it the reverse. A screen must never be left
  with no navigation at any width.
- Touch targets are at least **44 × 44px**.
- The lesson column is single-column at every width; it never becomes a grid.
- The bottom tab capsule sits above `env(safe-area-inset-bottom)`.
- `prefers-reduced-motion` removes transition and animation, never content.
- `prefers-contrast: more` darkens `{colors.muted}`, sharpens `{colors.edge}`,
  and forces any stray `backdrop-filter` off.

## Iteration Guide

1. Check this file first. If a value you need is missing, add it here and to
   `globals.css` in the same change.
2. Add the token, then consume it. Never let a component be the first place a
   colour appears.
3. Run `npm run a11y:audit` after any palette change — contrast is the reason
   this file exists, and both colours this identity shipped with on the first
   pass failed it.
4. Run `tests/type-scale.test.ts`, `tests/design-tokens.test.ts` and
   `tests/copy-guard.test.ts` after touching typography, tokens, or copy.

### Lint

```
npx -y @google/design.md lint DESIGN.md
```

Expected result: **0 errors**, with `orphaned-tokens` warnings for the tokens the
DESIGN.md component whitelist has no property for — border colours (`edge`,
`edge-soft`, the state lines), an outline (`focus-ring`), and the stock tints.
Do not "fix" them by inventing component entries; they are documented
deliberately.

### Why there is no generated token export

There is no `tokens.json` or Tailwind theme export next to this file, on purpose.
This codebase's failure mode is **duplicate tokens that drift** — the shell, the
French lesson and the Italian lesson each had their own copy of the palette.
`src/app/globals.css` is the implementation source of truth and this file is its
specification; the lesson files carry inline fallbacks for offline rendering, and
`tests/design-tokens.test.ts` asserts every one of them equals the real token. A
generated export would add a fourth copy.

## Known Gaps

- **The lesson engines still spell some things their own way.**
  `lesson-player.css` (Italian, v2) reads the shared tokens through its
  `--lp-*` aliases rather than directly. The aliases are correct and checked, but
  the indirection could be collapsed.
- **No dark mode.** If one is ever added, design a warm dark ground; do not
  invert this palette.
- **The offset-shadow language is a strong commitment.** Applied to too many
  elements at once it becomes a costume rather than a hierarchy — which is
  exactly what the first sketch did, and why the depth grade above is explicit.
