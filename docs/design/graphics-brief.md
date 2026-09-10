# Graphics brief — Warm Studio

Copy-paste prompts for **Nano Banana 2** (Gemini 3.1 Flash Image) to produce the
brand graphics that match the Warm Studio identity.

Written against the real asset inventory in `public/`, not from imagination. Two
things to know before you start are in **Read this first**.

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

## 2. Course banner template

Four exist at `public/brand/courses/{french,italian,spanish,portuguese}.jpg`,
all 2064×512. **German has no banner** and `courses/page.tsx` builds the path
from the slug, so it will 404 the moment German appears in the catalogue.

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

Two footguns in this repo, both already solved by `scripts/brand/from-generated.sh`:

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

## Housekeeping, not generation

`public/brand/voxlibre-app-icon-source.png` is a 1MB file from a different
project sitting in VerbaLibera's brand directory. Delete it or move it — it is
not part of this system.
