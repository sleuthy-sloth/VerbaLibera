# Sketch: Glass Material

## Variant: Glass Material

### Design stance
The Liquid Glass direction — but executed, rather than merely tokenised. The
app already defines `--glass-fill`, `--glass-blur`, `--glass-edge` and friends in
`globals.css`; the lesson never consumes them and re-types the recipe inline.

### Key choices
- **Depth is refraction, not decoration.** The field behind the panels is *sharp*
  and saturated. An earlier pass pre-blurred it into soft blobs and the result
  read as flat pastel stickers: blurring an already-smooth background is a no-op.
  The panels do the blurring, and the untouched gaps make it visible by contrast.
- **A real glass lip.** A 2px masked `backdrop-filter` band at the panel border
  runs sharper and brighter than the panel body, so the edge shifts what is
  behind it. This is the single biggest difference between glass and a
  translucent rectangle.
- **Warm paper survives.** Newsreader and Instrument Sans keep their roles.
- **The prompt collapses when you answer**, so the feedback gets the space the
  question no longer needs.
- **Labels sit on a chip.** Small tracked uppercase over a coloured field failed
  contrast; they are also 12px, the product's own type floor, where the first
  pass broke it at 11px/10px.

### Trade-offs
- **Strong at:** the thing the app is for — a phone, one-handed, short sessions.
  Depth reads instantly at arm's length and the material does the work that
  illustration would otherwise have to.
- **Weak at:** cost. `backdrop-filter` on every option, panel and sheet is real
  GPU work; the offline/portable bundle and older phones need measuring before
  this ships. Readability depends on the field staying controlled — a more
  saturated background starts eating the smaller labels.

### Best for
- A learner who wants the app to feel current and crafted, and a product that
  wants one material used consistently instead of three palettes that drifted.
