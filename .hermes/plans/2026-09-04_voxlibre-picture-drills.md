# VoxLibre — Picture-choice vocab drills (pilot, 2026-09-04)

User-approved: word↔photo matching activity. Pilot = ordering-pattern vocab
(coffee, tea, table, bill) × 4 languages. Pictures are language-neutral:
4 images serve all 4 courses.

## Design

- New `DrillKind.PICTURE_CHOICE` (Prisma enum + migration; TS type).
- `DrillFixture` gains optional `choices?: readonly {id,imageUrl,alt}[]`.
  `recallTarget` + `acceptedResponses[0]` = correct choice id (existing
  verdict pipeline takes client verdicts — no server change needed).
- Ordering concepts get a 2nd drill (`<id>-picture`); other patterns keep 1.
- Images committed to `public/images/vocab/` + `docs/image-provenance.json`
  (source URL, author, license, sha256) — CC0 / public-domain only, no
  attribution traps. Offline-first: no hotlinking.
- UI: choice grid in GuidedSession for PICTURE_CHOICE (Quiet Ink, 4 big
  buttons, focus-visible, reduced-motion, `role=radiogroup` semantics).

## Steps (TDD, commit per step)

1. **Schema**: enum + `prisma migrate dev`, TS `DrillKind`, seed passthrough
   check. Tests: seed counts (drillItem 32→36, audioSegment unchanged).
2. **Fixture**: vocab choices + picture drills on 4 ordering concepts.
   Tests: choices present, correct id accepted, image URLs under /images/vocab/.
3. **Images**: fetch 4 CC0 files via Commons API, verify license per file
   page, write provenance doc. Tests: files exist, provenance hashes match
   (small script or test reading the JSON).
4. **UI**: PictureChoice component + GuidedSession wiring + verdict submit.
   Tests: component (select correct → exact verdict; keyboard operable),
   existing drill tests unaffected.
5. Full verify (test/typecheck/lint/build/e2e guided-session), commit, push.
