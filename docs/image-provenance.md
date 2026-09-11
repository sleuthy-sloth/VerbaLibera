# Image provenance — picture-choice vocab and lesson scenes

Twenty-two vocabulary pictures live under `public/images/vocab/`, and five lesson
scenes under `public/images/scenes/`.

**Twelve of the vocabulary pictures are CC0 or public domain** (no attribution
required) sourced from Wikimedia Commons. License verified per file page before
download. Files were verified visually (each clearly depicts its word), resized to
max 800px (`sips -Z 800`), and served from the app's own `public/` dir — no
hotlinking. The SW caches `/images/**` like `/audio/**`.

**Ten vocabulary pictures and all six lesson scenes are the project's own approved
artwork**, supplied as files and normalised here — the tables below.

Rejected during visual review (not shipped): a train-interior shot mislabeled as a
station, a too-dark bar photo for shopkeeper, and the Greenwich Hospital building
(ambiguous — replaced by Hakodate Red Cross Hospital with its rooftop cross, which in
turn has since been replaced by the approved illustration recorded below).

## CC0 and public-domain photographs (12)

| file | depicts | source | license | sha256 |
| ---- | ------- | ------ | ------- | ------ |
| `bill.jpg` | itemized restaurant receipt with total | `File:HK SYP … bill receipt January 2026 N13P 02.jpg` | CC0 | `18cb31c12fa0ff5d4f917ecb5c5183c237807a4156457ea95a56c2c392eb9db1` |
| `shopkeeper.jpg` | market vendor at his stall with goods | `File:Elderly street vendor (Unsplash).jpg` | CC0 | `cc6a1b0540783cb5310b16df1ef809950615f483e3edbe35ba066a510f37f1a2` |
| `door.jpg` | wooden door close-up with handles | `File:Wooden door (Unsplash).jpg` | CC0 | `538f36b2bfe8aeaab5ee5e7bd40f608294373755febd6112c99611d7cbea53af` |
| `station.jpg` | Taipei Station hall with station signage | `File:Taipei Railway station interior (Unsplash).jpg` | CC0 | `df6a6a0a66e43ec2c89f0870a3941a67fc0ed0ef162a936f68fc2394da0d2de6` |
| `museum.jpg` | grand museum palace building | `File:AfricaMuseum in Tervuren (Belgium).jpg` | CC0 | `6a41c020f22d3c7021417e1b7a8ff6a05324f438eed4f2bf8b432c517c03064b` |
| `street.jpg` | quaint cobblestone city street | `File:Quaint City Streets (Unsplash).jpg` | CC0 | `4dcc6bbabb74511798a84ef201986c5e6a6d14f4b1c29c2c68568b77b986d9db` |
| `map.jpg` | map with colorful push-pins | `File:Map with colorful pins (Unsplash).jpg` | CC0 | `05042861c06d61f85d70bdd81033330641b4b70ff0678409fbdb654d00b6c0de` |
| `phone.jpg` | hand holding a smartphone | `File:Black smartphone in hand (Unsplash).jpg` | CC0 | `c352e46e9a3555db14fbb7e0a2942cbaf38716d3b0c85048a43cefc7bb5a6bac` |
| `passport.jpg` | Canadian passport on a desk | `File:Passport documents desk (Unsplash).jpg` | CC0 | `2816d49c4cd8cd32b7b876ac22e398a64438c82d7d5bb0c54b772683c9476427` |
| `card.jpg` | bank card in a payment terminal | `File:Card Payment (176811287).jpeg` | CC0 | `2db27853236640e8a69e0a661e9f3abb72264765d9f1e7590eaecc302b77733b` |
| `wallet.jpg` | quilted purse held by a woman | `File:Checking Her Purse (Unsplash).jpg` | CC0 | `05dad81edc77f8a73a17b9b3bd9772f2f002cbffa28e28faa44b91c23b5d7b31` |
| `hotel.jpg` | turquoise hotel building with palms | `File:Blue hotel building (Unsplash).jpg` | CC0 | `32289b712d4fe093f529c25f345cc40a57e6f53998cdfd57686cc3afef326016` |

Source pages: `https://commons.wikimedia.org/wiki/<File:name>` for each
title above. If a source file's license ever changes upstream, replace the
image — the CC0 / public-domain status at time of download is recorded here.

### The two pictures still waiting for standalone artwork

`bill.jpg` and `shopkeeper.jpg` are still the CC0 photographs recorded above, and they
are the only two drill pictures left in the felt-tip illustration set's debt. The
approved six-panel reference contains both subjects — a receipt panel and a market
stall — but it is a **collage**, and the receipt panel has the word "BILL" drawn into
the artwork, which is why it can neither ship as a picture nor be cut up into one:
instructional copy must not live inside an image, and the repo's rule is that artwork
lettering never becomes UI (see the hotel sign below).

Standalone sources were looked for and do not exist in this project's filesystem:
every attachment folder delivered so far has been accounted for (the ten-file batch
supplied with the hospital picture turned out to hold ten other subjects — a shop door,
two building entrances, a street of facades, a map spread out with a compass, a desk with
a phone and a coiled cable, a desk with a clipboard and a blank badge, a card payment
terminal with blank receipt paper, a wallet with cards and coins, and a hotel entrance
with a luggage cart — and none of them a receipt or a market stall), `~/Downloads` holds
only the brand references, and the repo carries no source art. **Both pictures therefore stay as they are**, and what they
need is two standalone files, supplied at any size like the rest of the set, after which
they take the same four steps as every other replacement: resize to 800×449, snap the
ground if the file's most common colour really is one, check the alt text against what
is drawn, and extend the tables here.

## The project's own illustrations

Nine of the vocabulary pictures were replaced with the approved flat
illustrations — the same illustration system as the course banners, which answers
the mismatch `docs/design/graphics-brief.md` §7 records ("they are currently
photographs, which is the single biggest mismatch with the illustration system").
They arrive at whatever size the art was supplied in and are normalised to that
section's generation contract, **16:9 at 800×449**, with
`sips --resampleHeightWidth 449 800`.

They are project artwork: no third-party licence, no attribution, nothing to
re-verify upstream. Each was checked against what it actually depicts, and the alt
text in `src/features/curriculum/fixture.ts` was corrected wherever the old
photograph's wording no longer described the drawing — the drill's accessible name
*is* that alt text, so a stale one announces the wrong picture rather than merely
reading oddly.

| file | depicts | alt text | dimensions | bytes | sha256 |
| ---- | ------- | -------- | ---------- | ----- | ------ |
| `piggybank.jpg` | white piggy bank, coins and a card on a wooden table, plant and cloth behind | A piggy bank with coins on a table | 800×449 | 87,393 B | `31ae4814adf705d183894dbae79695df2e64af96dce0db67499e2b2b9f3d4aa6` |
| `tea.jpg` | teapot and a cup of tea on a mat, with a leaf | A teapot and a cup of tea | 800×449 | 70,608 B | `1d07d4d43bc58b1c8c7943ba5630b503587c5bab9fce13f52f4c8e59f2288f2b` |
| `coffee.jpg` | cup of coffee on a saucer with a spoon and a lidded sugar bowl | A cup of coffee on a saucer | 800×449 | 69,716 B | `bdf3db8c674afca57e2967ab0f4020296a5b77b63b1c30f1d78499d116c3fa98` |
| `table.jpg` | round café table with two chairs, a cup and a folded napkin | A café table with two chairs | 800×449 | 75,844 B | `884631285eda7d9e9d44c25a8eeaab663f1f965f1b672ce07be64c011917e8b7` |
| `key.jpg` | old-fashioned skeleton key with a blank tag, beside a green door and its lock | An old-fashioned room key with a blank tag | 800×449 | 85,847 B | `19e3e618dd08b3984b601ce9b890a2c25d204d52c68f76104484eb48ff8c155a` |
| `bed.jpg` | single hotel bed with a folded towel, nightstand and lamp | A made hotel bed with a folded towel | 800×449 | 62,458 B | `f596bd00a3003791748033c604ce86941be6330239cdff48dd618a0e504e42de` |
| `suitcase.jpg` | green hard-shell suitcase with a blank tag, beside a folded map and a belt | A green suitcase beside a folded map | 800×449 | 82,462 B | `0d53b4c1ea56702fc357c47f7c80902a753431a1a88789e93afa69af94510a05` |
| `ambulance.jpg` | ambulance van with a red, white and blue roof light bar, parked outside a building | An ambulance parked outside a building | 800×449 | 95,653 B | `42c5b5db912700b9cbbb62fe8116d2fc723ca06dbbb0d741fb62eff5f50e3158` |
| `police.jpg` | beige police sedan with a blue and red roof light, parked on a street | A police car with its roof lights on | 800×449 | 107,407 B | `c7bbf248974f6bd14c9aecac1e5fce24e14bb96d27aa7208b88d5071031e1d4d` |
| `hospital.jpg` | hospital entrance: steps, green double glass doors, two potted plants, and a sign with a serpent-and-staff medical emblem | A hospital entrance | 800×449 | 83,360 B | `1163e7215905be8b180b6a4200565fbfcefb98c8b56ec2f898b387c47facb058` |

### Snapping the ground, and the one file that must not be

Snapping makes a flat cream field exactly the canvas colour, so the picture does
not sit on the page as a faint rectangle. **Eight of the nine are snapped**: their
most common colour is a cream ground 10–14 units off the canvas, and snapping
remaps 28–71% of the frame to the exact value (the four earliest files came back
exact from the previous batch, so they were untouched here).

**`key.jpg` is deliberately not snapped**, and it is not alone. The script's premise
is that the most common colour in a file *is* its flat ground; in `key.jpg` that colour
is the drawn olive door (`#7a8e6b`, 129 units from the canvas), because the door fills
more of the frame than the surface the key lies on, and snapping would repaint it cream.
The same reasoning was applied to `hospital.jpg` (its most common colour is the tan
facade, `#e1caa0`, 70 units) and to the `asking-for-the-bill` and `minor-emergency`
scenes below (`#d9c394` and `#dcc99f`). Every one of these decisions is recorded rather
than automated: `scripts/brand/snap-ground.py --check` reports them as "off", which is
correct and expected, and nothing in the tree runs that check as a gate.

## The lesson scenes (6)

Six approved situation pictures, one per situation the courses teach, under
`public/images/scenes/` at **800×600** — the 4:3 frame they are drawn in, so the
lesson surfaces render them with `height: auto` and never crop or stretch them.
They map to situations in `src/features/course-pack/scenes.ts`, which is what
decides *where* each one appears; this table is what they are.

| file | situation | depicts | dimensions | bytes | sha256 |
| ---- | --------- | ------- | ---------- | ----- | ------ |
| `ordering-coffee.jpg` | ordering coffee | a customer at a café counter, espresso machine and grinder, a cup of coffee on the counter | 800×600 | 109,405 B | `74b87dd242f6861fbd5ca50c759fb31c763d0c8195cf9ccc43970aadc972dccf` |
| `asking-for-the-bill.jpg` | asking for the bill | a guest at a restaurant table, hand raised to call the server, empty plate and a bill presenter | 800×600 | 108,541 B | `3315377e9605bc36998e071f728c997eb2ac1bdfbca3f7bcecc15412adf33c52` |
| `hotel-checkin.jpg` | hotel check-in | a guest with a suitcase at a reception desk, receptionist behind the counter, register book, key and bell | 800×600 | 136,103 B | `15397060811e2df6048f8f73c4db1dfcf2cbeec622b767e90a3f809d65fd8c6e` |
| `directions.jpg` | asking for directions | two people pointing at a large street map mounted on a wall, a table with an open map and a pen | 800×600 | 142,932 B | `f1f431423f7aed352cda9fa5c982c6a30e00248dd65babf7feb13b7a7baa1784` |
| `station-counter.jpg` | buying a ticket at a counter | a clerk and a customer exchanging a ticket through a glass counter window, coin tray, wall clock | 800×600 | 178,759 B | `0bb740222cb58697ace5294a15b22e7ff1afa11d30bbf26cd5edfe0a25ad8247` |
| `minor-emergency.jpg` | getting help in an emergency | two people on a street corner: one crouching and pointing at a phone on the pavement, a messenger bag beside it, a red first-aid kit with a white cross at their feet | 800×600 | 136,968 B | `847d14d69d6a341fa692b68d84ffb7e631cc2113770e01bd031bf709bc5bb5ed` |

Five of the six were snapped to the canvas ground (their most common colour is a
cream field 9–12 units off it, remapped on 17–58% of the frame);
`asking-for-the-bill.jpg` and `minor-emergency.jpg` were not, for the reason recorded
above — the emergency scene's most common colour is the drawn flagstone paving
(`#dcc99f`, 71 units from the canvas), so snapping it would have repainted the
pavement cream. Each was re-read
for coherence after snapping — outlines, colour containment and shadows unchanged —
and the check below was run against the final bytes rather than the supplied
sources.

### The lettering inside the artwork

Every supplied file was checked one by one for baked-in text, because instructional
copy must not live in a picture and artwork lettering must never be duplicated into
the UI:

- **`hotel-checkin.jpg` carries one sign: `RECEPCIÓN`**, printed in Spanish on a
  wall behind the reception desk. It is recorded here, as text, in this document —
  which is the only place it appears. It is **not** rendered as copy, not used as a
  label, not an alt text, and deliberately absent from every file under `src/`:
  `tests/scenes.test.ts` greps for it and fails if it turns up anywhere in the app.
  Worth knowing when reviewing the picture: that sign is Spanish while the courses
  it will appear in are French, Italian, German, Spanish and Portuguese, so on a
  French or Italian lesson the reception sign is not in the learner's language.
  That is an art-direction question for whoever reviews the scene, not something
  code can fix.
- **Every other scene file contains no lettering at all**, including
  `station-counter.jpg`, whose supplied description warned it might: the clock has
  tick marks and no numerals, the counter sign is blank, and the document being
  handed over is unmarked.
- The nine vocabulary illustrations contain no lettering either: the key's tag, the
  suitcase's luggage tag, the hotel registration book and the ambulance's side are
  all blank, and no number plate is legible.

The scenes are **decorative on the lesson surfaces** — every one renders with
`alt=""`, because the lesson title, its objective and the session's `Scenario` line
already say what the picture shows in words. Where a picture *is* the question (the
vocabulary drills), the alt text is the accessible name and is recorded above.

## The course map (1)

One picture for the surface that shows the path ahead: `public/images/course-map.jpg`,
rendered at the head of `/learn/<course>/plan` — the one progress surface that
describes a route through the course rather than a list of what is unlocked
(`src/features/course-pack/course-map.ts`). It is resized on width alone to **800×537**,
which is the file's own 1.49:1 frame: the six stations on the route run to its edges,
so cropping it to the 4:3 of the lesson scenes would cut the flashcards and the
notebook off the ends of the path. Its ground was snapped (its most common colour is
the parchment field, `#f9f1dc`, 10 units off the canvas, remapped on 58% of the
frame).

| file | depicts | dimensions | bytes | sha256 |
| ---- | ------- | ---------- | ----- | ------ |
| `course-map.jpg` | a winding path linking six study stations: an open book, headphones, flashcards, a stack of books, an audio player and a notebook with a pencil | 800×537 | 100,789 B | `1df8cbdee211f279dcc524dac332081cd4f158bb5721e5f5689c01c22fc5d28b` |

It is **decorative** on that page — the heading names the course and the checklist
below is the actual route — and it is deliberately absent from the portable and
downloaded editions, because the plan page is a hosted account surface that needs a
session cookie; those editions carry the course path and the audio lessons instead.
Its artwork contains no lettering: the books, cards and notebook are all blank.

Re-verify hashes any time with:
`shasum -a 256 public/images/vocab/*.jpg public/images/scenes/*.jpg public/images/course-map.jpg`
