---
version: alpha
name: VerbaLibera — Quiet Ink
description: An offline-first language-learning surface built on warm paper, deep teal, and frosted glass. The system pairs a literary serif (Newsreader) for headlines with a neutral humanist sans (Instrument Sans) for everything a learner reads, over a warm off-white canvas rather than the cool grey most learning products use. There is exactly one accent — a deep teal — and no product surface is ever pure grey. Glass is a material rather than a decoration — frosted translucent panels with a hairline white edge, an inset top highlight, and soft elevation, and the same recipe appears on navigation, cards, and practice feedback. Restraint carries the brand, so the system has no gradients, no confetti, no celebratory colour, and no progress bars that imply a score.

colors:
  canvas: "#f4f3ee"
  surface: "#ffffff"
  ink: "#1a1f1e"
  ink-deep: "#0f1312"
  muted: "#586360"
  primary: "#1e6563"
  primary-strong: "#174b4a"
  primary-soft: "#e4edeb"
  hairline: "#d8d4c8"
  focus-ring: "#1e6563"
  state-correct-fill: "#e3efec"
  state-correct-line: "#1e6563"
  state-attention-fill: "#f7ece7"
  state-attention-line: "#d8b3a6"
  state-attention-ink: "#8f4b3a"
  paper-soft: "#f5f3ee"
  surface-warm: "#fffdfa"

typography:
  display-lg:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: 44px
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  display-md:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: 34px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  display-sm:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: 26px
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0em"
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
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
  button:
    fontFamily: "Instrument Sans, Arial, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0em"

rounded:
  sm: 10px
  md: 14px
  glass: 20px
  pill: 999px

spacing:
  xs: 6px
  sm: 12px
  md: 20px
  lg: 32px
  xl: 48px
  section: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 14px
    height: 48px
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  button-primary-large:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.glass}"
    padding: 18px
    height: 56px
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 14px
    height: 48px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 12px
  glass-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.glass}"
    padding: 20px
  feedback-correct:
    backgroundColor: "{colors.state-correct-fill}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.glass}"
    padding: 20px
  feedback-attention:
    backgroundColor: "{colors.state-attention-fill}"
    textColor: "{colors.state-attention-ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.glass}"
    padding: 20px
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
  session-summary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-sm}"
    rounded: "{rounded.glass}"
    padding: 20px
  bottom-tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: 66px
---

## Overview

Quiet Ink is the visual language of an app that asks a beginner to look at
unfamiliar words on a phone, offline, often at night, often for eight minutes at
a time. Everything follows from that: high legibility, low glare, no urgency.

Two commitments define it.

**Warm, not clinical.** The canvas is `#f4f3ee` — warm off-white paper, not
`#f5f5f5`. Text is `#1a1f1e` — near-black with a green cast, not pure black. Most
learning products sit on cool grey; this one sits on paper. That single choice is
most of what makes the product feel considered rather than generated.

**One accent, used sparingly.** A deep teal (`#1e6563`) is the only saturated
colour in the system, and it appears on primary actions, focus rings, and the
active state of navigation. When a screen has two teal elements, one is almost
certainly wrong.

### What the system deliberately does not have

- **No gradients.** Not on buttons, not on cards, not on the canvas.
- **No celebratory colour.** There is no green "you win" and no red "you lose" at
  scale. Feedback uses the muted states in `{component.feedback-correct}` and
  `{component.feedback-attention}`, which tint the glass rather than shouting.
- **No score, streak, or XP colour.** The product promises no streak anxiety, and
  a progress bar in the accent colour is the closest it comes to gamification.
- **No dark mode.** Not yet, and not by inverting this palette — a warm-paper
  system needs a warm-dark counterpart, not `#000`.

## Colors

- **Canvas (`#f4f3ee`)** — Warm paper. The background of every page.
- **Surface (`#ffffff`)** — Pure white, used only under glass and for inputs,
  where maximum legibility matters.
- **Ink (`#1a1f1e`)** — Primary text and headings.
- **Ink Deep (`#0f1312`)** — Reserved for the highest-contrast display text.
- **Muted (`#586360`)** — Secondary text. Measured to hold **5.61:1** on canvas
  and **6.14:1** on surface, so it passes AA for body text and is safe for
  labels. `#6b7672` measured 4.24:1 on canvas and **must not** be reintroduced;
  `npm run a11y:audit` guards this.
- **Accent (`#1e6563`)** — The single interactive colour. Primary buttons, focus
  rings, active navigation, and the left rule on the end-of-session summary.
- **Accent Soft (`#e4edeb`)** — Accent at wash strength, for filled states.
- **Hairline (`#d8d4c8`)** — Warm grey rule. Borders are warm; a cool grey border
  on warm paper reads as a mistake.
- **State correct (`#e3efec` fill, `#1e6563` line)** — A right answer.
- **State attention (`#f7ece7` fill, `#d8b3a6` line, `#8f4b3a` ink)** — A wrong
  answer or a near miss. Warm terracotta, never alarm red.

State colour is always a **redundant** cue. The headline already says whether the
answer was right; the tint exists so a learner skimming a phone gets the same
answer at a glance. Never encode the outcome in colour alone.

## Typography

Three families, three jobs, no overlap.

- **Newsreader** (`{typography.display-*}`) — a literary serif for headlines,
  lesson titles, and the end-of-session phrase list. Weight 400 only; this system
  never bolds a serif. This is the voice of the app.
- **Instrument Sans** (`{typography.body-*}`) — everything a learner reads: body
  copy, prompts, buttons, navigation.
- **IBM Plex Mono** (`{typography.label}`) — uppercase eyebrows, metadata, skip
  links, 0.08em tracking. Small, technical, and never used for prose.

**Type floor: 12px (0.75rem).** Nothing readable may be smaller. Labels shipped
at 8.6px and 9.3px once and were unreadable on a phone; `tests/type-scale.test.ts`
enforces the floor across every stylesheet.

Font stacks always carry a fallback, because the offline/portable bundle ships
without the Next.js font loader:
`var(--font-body, Arial, Helvetica, sans-serif)`.

## Layout

- Content column maxes at **1000px** on the lesson surface, centred.
- Page padding is fluid: `clamp(20px, 5vw, 64px)`.
- Mobile leaves **84px + safe-area** at the bottom of the body for the floating
  tab capsule.
- Vertical rhythm is generous. A lesson is read, not scanned; dense grids fight
  that.
- Prose measures stay near **55–65 characters**.

## Elevation & Depth

Glass is the only elevation in the system. Depth comes from a single recipe,
expressed once as tokens in `src/app/globals.css` and consumed everywhere:

```
--glass-fill:      color-mix(in srgb, var(--surface) 62%, transparent)
--glass-fill-strong: color-mix(in srgb, var(--surface) 78%, transparent)
--glass-blur:      blur(22px) saturate(1.8)
--glass-edge:      color-mix(in srgb, #ffffff 55%, transparent)
--glass-highlight: inset 0 1px 0 color-mix(in srgb, #ffffff 65%, transparent)
--glass-shadow:    0 8px 28px color-mix(in srgb, var(--ink) 16%, transparent)
--glass-shadow-sm: 0 2px 12px color-mix(in srgb, var(--ink) 12%, transparent)
```

Four properties, always together: a translucent fill, a hairline light edge, an
inset top highlight, and a soft shadow below. **Components must consume the
tokens — never re-type the recipe.** A hand-written `blur(22px) saturate(1.8)`
with literal colours is how three palettes happened (see Known Gaps).

There are no hard drop shadows outside the glass recipe, and no elevation change
on hover. Glass panels do not stack more than two deep.

## Shapes

- `{rounded.sm}` 10px — inputs inside a panel.
- `{rounded.md}` 14px — buttons.
- `{rounded.glass}` 20px — the default. Panels, cards, feedback.
- `{rounded.pill}` 999px — the bottom tab capsule, chips, word-bank tokens.

Radii are generous and consistent. Nothing in the system is square except table
rules and the left rule on the session summary, which is a deliberate 4px accent
stripe.

## Components

**`button-primary`** — Teal background, white text, 48px tall, `{rounded.md}`.
Used once per screen. A screen with two teal buttons has no primary action.

**`button-primary-large`** — 56px tall, `{rounded.glass}`. Reserved for the one
commitment moment on a page: "Begin practice", "Start learning".

**`button-secondary`** — White surface, ink text. Everything else.

**`text-input`** — White, `{rounded.md}`, 1px hairline. Focus is a 2px accent
ring via `:focus-visible`; focus is never removed, only restyled.

**`glass-panel`** — The default container. Carries the full glass recipe. Used for
navigation, the daily-path card, and practice feedback.

**`feedback-correct`** / **`feedback-attention`** — The practice feedback panel.
Same glass recipe, tinted with `data-outcome`. The panel's `<strong>` headline is
authored prose ("That's it." / "Almost — the accents are off."), never a grader's
category. `features/course-pack/feedback.ts` is the only module that decides this
wording, and `tests/exercise-feedback.test.tsx` fails if taxonomy reaches the
screen.

**`bottom-tab-bar`** — Floating glass capsule on mobile only, 66px, hidden at
≥768px where the app uses the top navigation instead. It must never be the only
navigation on a desktop viewport.

## Do's and Don'ts

**Do**

- Put every new surface on the tokens. If a design needs a colour that is not in
  this file, add it here first, then in `globals.css`.
- Keep the accent for one thing per screen.
- Give text a fallback stack; the portable bundle has no font loader.
- Reach for the glass tokens, never a copied recipe.
- Let a correct answer be acknowledged in words. Warm and specific beats
  celebratory.

**Don't**

- Don't reintroduce `#6b7672`, `#f5f3ee`, `#176a61`, `#222e2c`, `#536560`, or
  `#fffdfa`. Those are the drifted duplicates this file replaces.
- Don't hard-code `Arial` or `Georgia` on a surface. Use the font tokens so the
  lesson and the shell stay one product.
- Don't render a grader's category, an error taxonomy name, or a storage verb
  ("Save and continue") to a learner.
- Don't use colour as the only signal of an outcome.
- Don't add a score, streak, or XP colour.
- Don't nest more than two glass layers.

## Responsive Behavior

- **Breakpoint: 768px.** Below it the floating tab capsule carries navigation and
  the top nav is hidden; at and above it the reverse. A screen must never be
  left with no navigation at any width.
- Touch targets are at least **44 × 44px**.
- The lesson column is single-column at every width; it never becomes a grid.
- The bottom tab capsule sits above `env(safe-area-inset-bottom)`.
- `prefers-reduced-motion` removes transition and animation, never content.

## Iteration Guide

1. Check this file first. If a value you need is missing, add it here and to
   `globals.css` in the same change.
2. Add the token, then consume it. Never let a component be the first place a
   colour appears.
3. Run `npm run a11y:audit` after any palette change — contrast is the reason
   this file exists.
4. Run `tests/type-scale.test.ts` and `tests/copy-guard.test.ts` after touching
   typography or learner-facing copy.

### Lint

```
npx -y @google/design.md lint DESIGN.md
```

Expected result: **0 errors, 7 `orphaned-tokens` warnings.** The warnings are the
tokens the DESIGN.md component whitelist has no property for — border colours
(`hairline`, `state-correct-line`, `state-attention-line`), an outline
(`focus-ring`), a wash (`primary-soft`), and the two drifted values this file
exists to retire (`paper-soft`, `surface-warm`). Do not "fix" them by inventing
component entries; they are documented deliberately.

### Why there is no generated token export

There is no `tokens.json` or Tailwind theme export next to this file, on purpose.
This codebase's entire typography and palette problem is **three copies of the
same tokens that drifted apart** (see Known Gaps). `src/app/globals.css` is the
implementation source of truth and this file is its specification; a generated
third copy would re-create the exact failure this document was written to fix.
If a tool ever needs machine-readable tokens, generate them from `globals.css`
at build time rather than checking in a duplicate.

## Known Gaps

Two divergent palettes and two divergent type stacks still ship, and they are the
main reason the lesson surface looks like a different product from the app around
it. Measured on `main`:

| Role | Canonical (this file) | `--lp-*` (Italian lesson) | local `study.css` (French lesson) |
|---|---|---|---|
| paper | `#f4f3ee` | `#f5f3ee` | `#f5f3ee` |
| ink | `#1a1f1e` | `#222e2c` | `#222e2c` |
| muted | `#586360` | `#536560` | `#536560` |
| accent | `#1e6563` | `#176a61` | `#176a61` |
| surface | `#ffffff` | `#fffdfa` | `#fffdfa` |
| body font | Newsreader / Instrument Sans | same | **Arial** (fixed for body + headings) |
| glass tokens | 8 defined | 0 consumed | 0 consumed |

The lesson surfaces agree with each other and disagree with the shell. The French
lesson additionally re-implemented the glass recipe inline (the literal
`blur(22px) saturate(1.8)` appears repeatedly) and set headings in Georgia while
the shell used Newsreader.

Closed so far: the lesson body and headings now read the font tokens with their
old values as fallbacks, and feedback carries `data-outcome`.

Still open:

- Migrate `--lp-*` and the local `study.css` variables onto these tokens and
  delete the duplicates. Replace the inline glass recipe with the `--glass-*`
  tokens. This is mechanical and should land as one CSS-only change with no
  markup edits.
- No dark mode. If one is ever added, design a warm dark canvas; do not invert.
