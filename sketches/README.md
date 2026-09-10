# Sketches — design directions considered

Throwaway exploration from 2026-09-10, kept as the rationale for the identity
that shipped. **Warm Studio (`003`) is what the app now uses**; the other two
were rejected. The live system is `DESIGN.md` at the repo root — these are the
drawings, not the spec.

| Direction | Stance | Outcome |
| --- | --- | --- |
| `001-glass-material` | Liquid Glass, executed — sharp field, refractive edges | Rejected. Most impressive and the most fragile: I had to iterate it three times before it read as glass, it costs a `backdrop-filter` per panel on a PWA that must run offline on a cheap phone, and its two signature colours fail AA |
| `002-broadsheet` | Language learning as reading — no cards, no shadows, hairlines | Rejected. Calm and distinctive, but it under-sells the audio and speaking work and is the least "eight minutes on the bus" of the three |
| `003-warm-studio` | A crafted object — cream stock, hard offset shadows, no blur | **Shipped.** Friendliest of the three, cheapest to render, and the one that makes a nervous beginner feel capable |

## What is here

- `NNN-<stance>/index.html` — a self-contained mock of the same moment (French
  Lesson 1, step 1, answered). Click **Check answer** in each.
- `NNN-<stance>/README.md` — stance, key choices, trade-offs.
- `compare.html` — all three side by side.
- `shoot.mjs` — screenshots every variant and asserts each fits a 390×844 phone
  in both states (question and answered) with no overflow, no overlap, and the
  primary action above the fold. Run `node sketches/shoot.mjs`.

## Two things these sketches got wrong

Worth knowing before treating them as a spec:

1. **`003` shipped with two colours that fail WCAG AA** — `#c2662f` (3.94:1 under
   white text) and `#8a7c62` (3.73:1 on cream). Both were corrected in the real
   system to `#a8511f` and `#6b5f4b`. The sketch files keep the originals
   deliberately, so the correction is visible in the difference.
2. **A mockup that looks right can be broken.** The first build of `001` passed
   a visual read and was actually clipping the prompt's last line: flex shrink
   plus `overflow: hidden` silently compressed the card, and a hidden feedback
   panel still occupied 43px of layout. Neither errors anywhere — it just reads
   as "a bit tight" in a picture. That is why `shoot.mjs` asserts instead of
   screenshotting and hoping.

Screenshots are gitignored (`*.png`); regenerate them with `shoot.mjs`.
