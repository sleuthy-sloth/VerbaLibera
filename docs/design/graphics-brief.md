# Graphics brief — Warm Studio

Copy-paste prompts for **Nano Banana 2** (Gemini 3.1 Flash Image) to produce the
brand graphics that match the Warm Studio identity.

Written against the real asset inventory in `public/`, not from imagination. Two
things to know before you start are in **Read this first**.

---

## Status

**All assets generated, installed and verified (2026-09-10).** Commit `9dbb328`.

| Asset | Size | State |
|---|---|---|
| Logo Mark | 1024×1024 | ✅ open book + speech bubble, monoline, no text — in `public/brand/` |
| Logo Lockup | 1792×592 | ✅ symbol only, left, 90% empty right — wordmark still goes on in code |
| App Icon | 1024×1024 | ✅ drove the 512/192/maskable icons, apple-touch 180 and the RGBA favicon |
| Course Banner ×5 | 2064×512 | ✅ fr, it, es, pt, **de** — one set, quiet left third, no baked text |
| Hero Banner | 1584×672 | ✅ dashboard artwork |
| Empty Journal | 1024×1024 | ✅ journal + seedling from the spine, blank pages |
| Social Card | 1200×630 | ✅ 16:9 cropped to the OG ratio; text verified verbatim |

Four of the five came back pixel-exact at the sizes the code needs; only the
social card needed cropping. Every ground needed snapping.

Install and re-snap with `scripts/brand/install-generated.py` — it maps each
prompt's output to the geometry the app expects and refuses to silently rescale
anything whose aspect ratio is wrong.

**Still worth doing (not blocking):** the 32 vocabulary images are photographs,
which is now the largest remaining mismatch with an illustration system. Section
7 has the template and the subject list if you want them redrawn.

---

## Read this first

### 1. Never ask for a transparent background

Image models render alpha unreliably — you get a checkerboard, a white box, or a
ragged edge that only shows up once it is on the page. **The app's ground is
already a solid colour.** Generate on that exact colour and ask for it
explicitly:

> flat solid `#fbf4e6` background, edge to edge, no border, no vignette, no drop
> shadow

The result drops onto the canvas with no compositing at all. This one habit
removes the most common reason generated brand assets look pasted on.

### 2. Generate the logo MARK with no text in it

Nano Banana 2 renders text well — that is the trap. A generated wordmark will be
in a font that is *nearly* Fraunces, and a near-miss typeface on the one mark
that appears everywhere is the most expensive mistake available. Generate the
symbol alone and set "VerbaLibera" in Fraunces in code. The existing lockup is a
1792×592 JPG with the words baked in at whatever typeface was to hand.

### 3. Expect the ground cream to come back wrong, and snap it

Measured across the seven assets actually generated, the model's colour fidelity
is excellent for everything *except* the ground:

| | generated | target | off by |
|---|---|---|---|
| ink (banner) | `#2f2b22` | `#2f2a24` | 2 |
| accent (banner) | `#a2521f` | `#a8511f` | 6 |
| **ground (logo mark)** | `#f6eed9` | `#fbf4e6` | **13** |
| **ground (app icon)** | `#f5edd8` | `#fbf4e6` | **14** |
| ground (banners) | `#f8f1df` | `#fbf4e6` | 7–8 |

Ink and accent are effectively exact — do not spend effort there, and do not
believe a vision model that says otherwise: the vision-estimated hex was off
from the true modal pixel colour by more than the real error in every case.

The ground matters because these assets are **opaque tiles laid on the cream
page**. `logo-mark.jpg` renders at 32×32 inside the nav header, where a 13-unit
drift reads as a faint rectangle around the mark. Snap it:

```bash
scripts/brand/snap-ground.py --check  ~/Downloads/*.jpeg   # report only, exit 1 if off
scripts/brand/snap-ground.py          public/brand/*.jpg   # rewrite in place
```

It finds the modal ground, remaps every pixel within 10 of it to exactly
`#fbf4e6`, and reports how much it touched. Verified on the real files: the mark
remapped 93.6% of its pixels (the ground), the in-memory result is exact, and a
re-read of the saved JPEG lands within 1 unit — JPEG rounding, invisible. The
risk was checked too: at 32px the mark's shape is unchanged and the tile edge
disappears into the header. Max per-pixel movement is 28, on 0.85% of pixels,
all of them anti-aliased stroke edges.

---

## The style block

Paste this at the top of **every** prompt below. It carries the palette, and the
model has no way to know any of it otherwise.

```
STYLE — "Warm Studio", a crafted print-like system. Flat vector illustration
with clean hard edges. Matte, opaque, no gradients anywhere. Colours, exactly:
cream ground #fbf4e6; card stock #fffdf7; deep warm brown ink #2f2a24; single
terracotta accent #a8511f; soft tan hairline #e0d3ba; muted olive-sage #6b5f4b;
muted sage green #2f6b3f. One accent colour only — terracotta. Think mid-century
educational print, risograph, or a well-made language textbook from the 1960s:
warm, calm, adult, quietly confident. Honest and human, never cute, never
childish, never corporate-tech.

MATERIAL: depth is stacked paper — flat colour shapes with a solid 1.5px
#2f2a24 outline and a hard offset shadow (4px right, 4px down, zero blur, solid
#2f2a24). Shapes are cut, not extruded; bevels are slightly uneven on purpose.

DO NOT INCLUDE: gradients, glows, blur, bokeh, drop shadows with any softness,
glassmorphism, frosted translucency, neon, 3D rendering, photorealism, lens
flare, sparkles, confetti, cartoon mascots, emoji faces, big-eyed characters,
clipart, stock-photo people, isometric tech illustration, purple, blue, teal,
green-teal, or any colour not listed above.
```

---

## 1. Logo mark

Currently `public/brand/logo-mark.jpg` — 1024×1024, **and it is a JPG**, so it
has no transparency, a baked background, and JPEG edge artefacts around the
strokes. It is the one asset that should be a flat single-colour vector-style
symbol.

```
[STYLE BLOCK]

A single simple emblem, centred, as flat vector line art. Subject: an open book
whose pages curve up into the shape of a speech bubble — reading and speaking in
one form. Drawn in flat 2D, arm's-length simple, four or five strokes maximum.
Line weight even and confident, roughly 6% of the canvas width. Single colour:
#2f2a24. No fill, no second colour, no outline around the whole shape, no
lettering, no text, no words.

The mark must stay readable at 32px, so keep it bold and uncluttered and leave
generous empty space around it — the symbol occupies the middle 62% of the frame.

Flat solid #fbf4e6 background, edge to edge, no border, no vignette, no shadow.

1:1 aspect ratio, 1024x1024, 2K output.
```

**Set it up properly:** convert to a real alphafill PNG before shipping, and keep
the cream-backed version as the fallback. `scripts/brand/from-generated.sh` does
the cut-out, the icon set and the RGBA favicon.

---

## 1a. Logo lockup — do NOT generate this one

Used in `FirstRunOnboarding` at 480×160 (3:1) — the first screen a new learner
ever sees. The existing `logo-lockup.jpg` is 1792×592 with the words baked in at
some earlier typeface.

Generating it means asking the image model for the wordmark, and you will get a
serif that is *almost* Fraunces. The lockup is the one place a near-miss
typeface is most exposed: 480px wide, with nothing else on screen to draw the
eye, next to real Fraunces text in the heading below it.

**Build it instead** — the mark is a PNG, and the wordmark is type:

```
[mark PNG]   VerbaLibera
             Learn a language by building sentences.
```

The snapped mark composites cleanly on cream (that is what item 3 buys you), and
the text is real Fraunces at whatever size the layout wants, crisp on every
display. Roughly twenty lines in `FirstRunOnboarding.tsx`, no new asset.

If you still want a raster lockup for something outside the app, generate the
symbol alone with generous space to its right and set the words in code over the
top — never let the model draw them.

---

## 2. Course banner template

Five exist now — `public/brand/courses/{french,italian,spanish,portuguese,german}.jpg`,
all 2064×512. German was missing and is not wired into the lesson view yet; see
*Wiring the German banner* below.

The banner is a *background band*, not a poster: it sits behind the lesson title,
so keep the left third quiet and put no faces or fine detail in the middle.
Generate one per language by swapping the last line.

```
[STYLE BLOCK]

A wide horizontal illustrated frieze, like the cover band of a 1960s language
textbook. Subject: a quiet street scene in Paris — a cafe terrace with two empty
chairs and a small round table, a zinc bar counter visible through a window, a
bicycle leaning on a wall, a plane tree, chimney pots on a roofline. Drawn as
simple flat vector shapes, wide and calm, arranged along the middle band of the
image. The left third is almost empty — just cream ground and a single roofline —
because a title sits there.

Palette: cream #fbf4e6 ground, shapes in #2f2a24, #e0d3ba, #6b5f4b and
terracotta #a8511f as the one accent (the cafe awning). Muted sage green #2f6b3f
for the tree only.

Flat solid #fbf4e6 background, edge to edge, no border, no vignette, no text, no
lettering, no flags, no landmarks used as clipart, no Eiffel Tower, no people.

4:1 aspect ratio (very wide, 2064x512), 2K output.
```

Swap the subject line for the other languages — the *scene* is what makes them
feel like a set, so keep the composition identical and change only the place:
- **Italian:** a small piazza — a cafe with a striped awning, a scooter against a
  wall, shutters, a stone fountain, cypress on the roofline. Accent awning.
- **Spanish:** a narrow street — a tiled doorway, a wrought-iron balcony, a
  laundry line, orange trees in pots, terracotta roof tiles.
- **Portuguese:** a tiled facade with an azulejo pattern band, a tram rail, a
  tiled shopfront, a bread rack, a hillside of rooftops.
- **German:** a timber-framed shopfront with a hand-painted sign board (no
  lettering), a stone fountain in a square, a beech tree, steep gabled roofs.

---

## 3. App icons

Currently 512/192/maskable PNGs plus a 180px apple-touch and a favicon. The icon
should be the logo mark on the cream ground, and it must survive being shrunk to
32px on a home screen.

```
[STYLE BLOCK]

An app icon: the open-book-becoming-a-speech-bubble emblem, drawn very simply in
flat #2f2a24 line art, centred, occupying the middle 60% of the frame. Nothing
else in the image.

Flat solid single-colour #fbf4e6 background filling the entire square, edge to
edge. No border, no rounded corners (the platform applies those), no shadow, no
text, no lettering, no badge, no glow.

1:1 aspect ratio, 1024x1024, 1K output.
```

**For the maskable variant** re-run with the same prompt plus:
> the emblem occupies only the middle 55% of the frame, with generous cream
> margin on every side, because a launcher will crop this to a circle.

---

## 4. Social card (`public/og-card.jpg`, 1200×630)

This one genuinely benefits from the model's text rendering — but it must be the
only asset where text is baked in, and it will be *close* rather than exact, so
budget a pass in code if it matters.

```
[STYLE BLOCK]

A social share card. Left 55%: cream #fbf4e6 ground with the headline set in a
warm high-contrast serif with generous letter-spacing, reading
"VerbaLibera" on one line and beneath it, smaller, "Learn a language by building
sentences." Right 45%: a simple flat vector illustration of a single sentence
being assembled from three separate word-tiles, the tiles as cream stock
rectangles with #2f2a24 outlines and hard offset shadows, scattered loosely as if
mid-arrangement. One tile carries the word "Bonjour".

Colours: cream ground, #2f2a24 ink, tan #e0d3ba and terracotta #a8511f accents
only. Flat and matte. No gradient, no glow, no photograph, no people.

1.91:1 aspect ratio, 1200x630, 2K output.
```

---

## 5. Dashboard artwork (`public/brand/hero-banner.jpg`, 1584×672)

Used at `/brand/hero-banner.jpg` as the illustration on the dashboard intro. It
sits beside the day's headline, so it is decorative and must not compete.

```
[STYLE BLOCK]

A calm still life on a warm cream ground: a closed notebook, an open pen, a small
cup on a saucer, a pair of reading glasses, and a folded newspaper. Simple flat
vector shapes, seen straight on from slightly above, arranged loosely in the
middle of the frame with plenty of empty cream space. Two colours only, #2f2a24
ink line work and #e0d3ba fills, with terracotta #a8511f on the cup only.

Flat solid #fbf4e6 background, edge to edge, no border, no vignette, no shadow,
no text, no lettering, no people, no hands, no photographs, no soft focus.

2.36:1 aspect ratio (1584x672), 2K output.
```

---

## 6. Empty-journal illustration (`public/brand/empty-journal.jpg`, 1024²)

Shown where a learner has not written anything yet — an honest empty state, so it
should read as inviting rather than as absence.

```
[STYLE BLOCK]

An illustration of an open blank notebook lying flat, seen from above, with a
pencil resting in its gutter and one blank page turned. Simple flat vector
shapes. Cream stock pages #fffdf7 with a #2f2a24 outline, a tan #e0d3ba spine,
terracotta #a8511f pencil. Nothing written on the pages — no lines, no text,
no squiggles, no lettering.

Flat solid #fbf4e6 background, edge to edge, no border, no shadow, no people.

1:1 aspect ratio, 1024x1024, 1K output.
```

---

## Framing: how much of its box the drawing actually uses

A generated illustration arrives with uneven baked-in cream. Inside a bordered
layout box that reads as a small mark floating in dead space, which is what
"tossed in" looks like. `scripts/brand/frame-audit.py` measures it: for each
asset, the drawing's bounding box as a share of the frame and the margin on all
four sides.

Measured on the shipped set:

| asset | art fills | margins L/R/T/B |
|---|---|---|
| logo-mark | 64% × 41% | 18 / 18 / 30 / 30 |
| logo-lockup | 15% × 34% | 9 / 76 / 33 / 33 (correct: the wordmark goes in the right side) |
| hero-banner | 48% × 68% | 26 / 26 / 17 / 16 |
| empty-journal | 73% × 61% | 17 / 9 / 15 / **24** |
| courses/french | 79% × 90% | 19 / 2 / 7 / 3 |

`scripts/brand/tighten-frame.py --margin 0.06 <files>` fixes them: it finds the
drawing, centres it in a crop of the SAME aspect ratio (so no declared
width/height has to change anywhere), and scales back to the original pixel
size. Re-snaps the ground afterwards, because rescaling resamples flat cream.

Applied to `empty-journal` (74%×61% → 88%×72%, margins even at 6/6/14/14),
`hero-banner` (48%×68% → 62%×87%) and `logo-mark` (64%×41% → 88%×56%).

Do not apply it to the course banners: their art already fills 87-93% of the
height, so the same-aspect crop cannot be any smaller than the frame and the
script correctly leaves them alone.

**Check the logo change in place before reverting it.** The mark looked fine at
64% of its tile and only when rendered next to the Fraunces wordmark did it read
as undersized, a footnote to the type rather than a lockup. An A/B of the real
header settled it; the measurements alone would not have.

**Next's dev image cache is `.next/dev/cache/images`, not `.next/cache/images`.**
Replacing a file in `public/` and re-capturing screenshots without clearing that
directory silently serves the OLD optimised image, so the new screenshots come
out byte-identical to the old ones. Check `git status` for the screenshots you
expect to have changed; identical hashes after an asset swap mean the cache, not
a no-op.

## The German banner

The generated German banner was the one asset that did not work, and it needed a
re-frame rather than a crop of the excess margin:

- **36% empty cream on the left** against 19-31% on the other four.
- The scene **ran off the right edge through a distinct building** rather than
  ending on it. This is not the same as the Italian banner, which also reaches
  the right edge: Italian's crop falls on a flat continuing façade, so it reads
  as a scene continuing past the frame. German's cut through a half-timbered
  house with a strong silhouette, roof, framing and window, which reads as an
  error.

Column analysis found the complete part of the scene ends just past the tree
(x≈1890), with a different building starting at x≈1899 and running to the frame.
Cropping there removes the sliced building.

The re-frame centres the complete 1160px scene: 22% cream each side, no art in
either outermost column, and the left void down from 36% to 22%. The trade-off,
recorded honestly: the other four bleed to the right edge and this one does not,
so it reads as a framed vignette beside four friezes. Matching the set exactly
needs the art regenerated wider, which is a generation job, not a crop:

```
[STYLE BLOCK]

A wide horizontal frieze of a German town square, drawn as simple flat vector
shapes arranged evenly ACROSS THE FULL WIDTH of the frame. From left to right:
a single low stone fountain, a bare beech tree, a modest two-storey
half-timbered house with a plain painted sign board and no lettering, and a
distant gabled roofline. Keep to four or five objects in total.

Critically: the scene ENDS well inside the frame. Every building and tree is
completely contained, with plain cream on both the left and right sides. No
object may touch, cross, or be cut by any edge of the image.

The left third is the emptiest part of the composition, because a title sits
there.

Palette: #fbf4e6 ground; shapes in #2f2a24, #e0d3ba, #6b5f4b; terracotta #a8511f
as the one accent; muted sage #2f6b3f for the tree only.

Flat solid #fbf4e6 background, edge to edge, no border, no text, no lettering.

4:1 aspect ratio (very wide, 2064x512), 2K output.
```

## 7. Vocabulary images (32 files, `public/images/vocab/*.jpg`)

These are already complete — 32 expected, 32 present, no orphans — at 800×449 in
the *travel and ordering* set (ambulance, passport, hotel, bill, policeman…).
**You only need to regenerate them if you want them on-palette**, because they are
currently photographs, which is the single biggest mismatch with the illustration
system. If you do, the template is:

```
[STYLE BLOCK]

A single object, centred, filling about 60% of the frame, drawn as simple flat
vector shapes — a friendly mid-century textbook illustration, not an icon and not
a photograph. Subject: a full cup of coffee on a saucer, seen from slightly
above, with a small spoon.

Colours: #2f2a24 outlines and shadow shape, cream #fffdf7 fills, terracotta
#a8511f on the cup, tan #e0d3ba on the saucer. Nothing else.

Flat solid #fbf4e6 background, edge to edge, no border, no frame, no shadow under
the object, no text, no lettering, no people, no hands, no photograph, no depth
of field.

16:9 aspect ratio (800x449), 1K output.
```

Subjects are the 32 ids already referenced in
`src/features/curriculum/fixture.ts` — do not invent new ones, and keep the
filename identical or the app will 404 the image.

---

## After generating: the technical pass

**Step 0 — snap the ground** (see *Read this first* item 3), or every asset
carries a faint rectangle against the page:

```bash
scripts/brand/snap-ground.py --check ~/Downloads/*.jpeg   # expect exit 1 today
scripts/brand/snap-ground.py -o public/brand/logo-mark.jpg ~/Downloads/"Logo Mark.jpeg"
```

Then two footguns, both already solved by `scripts/brand/from-generated.sh`:

1. **`src/app/favicon.ico` must be RGBA.** PIL defaults to RGB, and Next 500s
   *every page* with `The PNG is not in RGBA format`. The script always
   `.convert('RGBA')` before saving.
2. **The maskable icon needs a real safe zone.** Content inside the central 80%
   circle or a launcher will crop the mark.

```bash
# one generated square PNG -> the whole icon set + RGBA favicon
scripts/brand/from-generated.sh ~/Downloads/logo-mark.png

# a wide generated band -> the exact banner size
sips -Z 2064 --resampleHeightWidth 512 2064 generated.png --out public/brand/courses/italian.jpg
```

At the end, check nothing in the layout broke:

```bash
npx vitest run tests/service-worker.test.ts   # pins the precache asset list
npm run a11y:audit                            # images must keep their alt text
```

## Wiring the German banner

The asset now exists, but `src/features/course-pack/CourseWorkspace.tsx` resolves
the in-lesson banner from a hardcoded map, not from the slug:

```ts
const BANNER_BY_LANGUAGE: Record<string, string> = {
  french: "/brand/courses/french.jpg",
  italian: "/brand/courses/italian.jpg",
  spanish: "/brand/courses/spanish.jpg",
  portuguese: "/brand/courses/portuguese.jpg",
};
```

`/courses/german` and the landing showcase both build the path from the slug, so
they pick the new file up automatically — but the lesson view silently renders no
banner (line 389 returns `null` for an unknown language). One line:

```ts
  german: "/brand/courses/german.jpg",
```

## Fix the declared image dimensions while you are in here

Next reserves layout space from the declared `width`/`height`, so a wrong pair
causes a visible shift when the real image loads:

| File | Declared in code | Actual on disk |
|---|---|---|
| `hero-banner.jpg` | 1536×1024 (`DailyPathDashboard.tsx:189`) | 1584×672 |
| `empty-journal.jpg` | 1024×683 (`FirstRunOnboarding.tsx:12`) | 1024×1024 |

Both are decoration, so the mismatch is currently costing a layout shift for no
benefit. Correct them when you swap the artwork in.

## Housekeeping, not generation

`public/brand/voxlibre-app-icon-source.png` is a 1MB file from a different
project sitting in VerbaLibera's brand directory. Delete it or move it — it is
not part of this system.
