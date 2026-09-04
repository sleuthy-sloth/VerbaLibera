# VoxLibre Anki integration (2026-09-04)

User has Anki desktop → build AnkiConnect push (primary) from shared card builder.
One-way export only: VoxLibre SRS and Anki SRS stay independent (stated to user).

## Card design (per concept → up to 7 notes)
- dialogue: Front prompt + prompt audio, Back answer + answer audio
- recall (SUBSTITUTION/TRANSFORMATION drill): Front drillPrompt, Back acceptedResponses
- listen: Front "type what you hear" + answer audio, Back answer text
- vocab ×4 (picture choices): Front image + "What is this in X?", Back target word
- WORD_ORDER builder drills: skipped (interactive-only, stays in-app)

Per course: 8 dialogue + 8 recall + 8 listen + 32 vocab = 56 notes.
Model `VoxLibre`, fields [ID, Front, Back] (ID first → stable dup detection on re-push).
Deck `VoxLibre::<Target>`. Tags: voxlibre, course slug.

## Files
- `src/features/anki/notes.ts` — pure builder (no fetch)
- `src/features/anki/connect.ts` — invoke + pushDeck (fetch/readMedia injected)
- `src/components/anki/SendToAnki.tsx` — client button on learn page
- `src/features/curriculum/fixture.ts` — add exported `vocabWordFor(seedId, itemId)`
- Tests: `tests/anki-notes.test.ts`, `tests/anki-connect.test.ts`, `tests/SendToAnki.test.tsx`
- README "Study in Anki" section (add-on code 2055492159, Anki must be open)

## AnkiConnect protocol (verified 2026-09-04, foosoft/balta2ar docs)
- POST http://127.0.0.1:8765 `{action, version: 6, params}` → `{result, error}`
- Actions: version, createDeck, modelNames, createModel, storeMediaFile {filename, data b64}, addNotes
- Media: storeMediaFile first, reference `[sound:file]` / `<img src="file">` in fields
