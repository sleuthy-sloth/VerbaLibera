# Audio content authoring guide

This guide explains how to add a new spoken pattern to VerbaLibera without
shipping silent placeholders. It is the companion to the plan items
covered by the `audio-quality-checklist-*.md` files and the
`reconcile_provenance.py` helper.

## 1. Add the pattern to the curriculum fixture

Open `src/features/curriculum/fixture.ts` and append a new entry to the
`frenchPatterns` or `italianPatterns` array. Each `PatternSeed` needs:

- a stable `id` (lowercase, hyphenated, e.g. `it-find-place`)
- a `scenario`, `notice`, `title`, `explanation`
- a `prompt` and `answer` (these are the two spoken lines)
- a `drillPrompt` and one or more `acceptedResponses`

`makeConcept` automatically looks up an `audioUrl` for the seed via
`lessonAudioFor`; if no entry exists for the new id, both segments fall
back to `unavailable://`. That is the only thing you must NOT commit.

## 2. Author the WAVs

Kokoro 0.9.4 is the local TTS model behind every shipped clip. It is
reached through the sidecar at `POST /tts`, which validates language and
voice before returning WAV bytes. Each clip is committed to
`public/audio/{french,italian,spanish,portuguese}/` together with a sha256 of both the text
and the WAV in the provenance JSON under `docs/audio-provenance/`.

Create a manifest entry in `services/voice/scripts/`:

```json
{
  "clips": [
    {
      "id": "<seed-id>-prompt",
      "text": "<prompt text from the fixture>",
      "language": "<fr|it|es|pt>",
      "voice": "<ff_siwis|if_sara|ef_dora|pf_dora>",
      "filename": "<seed-id>-prompt.wav"
    },
    {
      "id": "<seed-id>-answer",
      "text": "<answer text from the fixture>",
      "language": "<fr|it|es|pt>",
      "voice": "<ff_siwis|if_sara|ef_dora|pf_dora>",
      "filename": "<seed-id>-answer.wav"
    }
  ]
}
```

Filenames must be unique, end in `.wav`, and contain no path traversal.
The script is `generate_lesson_audio.py`; it validates the manifest,
synthesizes via the loopback-only `POST /tts` endpoint, and writes both
the WAVs and a sidecar `docs/audio-provenance/<name>.json` with the
text/audio SHA-256 pairs.

## 3. Run the sidecar + export

```bash
# one-time
python3.11 -m venv services/voice/.venv
env -u PYTHONPATH services/voice/.venv/bin/pip install -r services/voice/requirements.txt

# each authoring session
export PHONEMIZER_ESPEAK_LIBRARY=/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib
export PHONEMIZER_ESPEAK_DATA_PATH=/opt/homebrew/opt/espeak-ng/share/espeak-ng-data
services/voice/.venv/bin/uvicorn services.voice.app:create_production_app \
  --factory --host 127.0.0.1 --port 8090 &

services/voice/.venv/bin/python services/voice/scripts/generate_lesson_audio.py \
  --manifest services/voice/scripts/<your-manifest>.json \
  --service-url http://127.0.0.1:8090 \
  --output-dir public/audio/<french|italian> \
  --provenance docs/audio-provenance/<your-manifest>.json
```

## 4. Wire the fixture

Add the new ids to the matching `frenchLessonAudio` / `italianLessonAudio`
record in `src/features/curriculum/fixture.ts`:

```ts
const frenchLessonAudio: Record<string, { prompt: string; answer: string }> = {
  // ...
  '<seed-id>': { prompt: '/audio/french/<seed-id>-prompt.wav', answer: '/audio/french/<seed-id>-answer.wav' },
};
```

Update the curriculum-fixture test to include the new id in
`SHIPPED_AUDIO` so the test refuses to ship an `unavailable://` entry.

## 5. Verify

```bash
services/voice/.venv/bin/python services/voice/scripts/reconcile_provenance.py
env -u PYTHONPATH services/voice/.venv/bin/python services/voice/scripts/stt_check.py
npm run test
npm run lint
npm run typecheck
npm run build
```

`reconcile_provenance.py` hashes every WAV on disk and refuses to
silently allow drift between the manifest and the committed provenance.
Run it after every audio change and before every commit.

## 6. Listen pass

Per `docs/audio-quality-checklist.md`, the automated artifact checks are
not a release gate. Before tagging a `feat:` commit that includes new
audio, run the listening review for the new clips and tick the four
subjective items in the matching checklist. Do not describe the clips as
linguistically reviewed until an FR/IT operator has signed off.

## 7. PWA cache note

`public/sw.js` already precaches `/audio/**`; once a learner visits a
lesson once, the new WAVs persist for the lifetime of the
`verbalibera-static-v2` cache. Bumping the cache version forces a refresh
on the next deploy.

## 8. What a released unit has to be able to report

A unit is a `unitId` in a pack: one to five lessons that share a theme. Before its
lessons count as released, the generated matrix has to be able to state, for that
unit, what is present and what is missing. `npm run content:outcomes -- --write`
writes it to `docs/curriculum-matrix.md`, one contract per unit, and
`tests/content-authoring.test.ts` holds the rules.

The twelve items, each reported as `present`, `absent`, `pending-review` or
`not-applicable`:

1. communicative objective
2. prerequisite concepts and vocabulary
3. introduced and later-retrieved vocabulary and patterns
4. recognition practice
5. target-language production
6. listening practice and referenced media
7. optional self-compare speaking
8. lesson-family variety
9. prose-review state
10. audio-listening-review state
11. media provenance and integrity
12. web, offline-download and portable compatibility

Three rules apply to every one of them.

**A state is never a judgement about the language.** These are structural checks:
"this unit has a production step", "every media reference resolves", "the record
says the prose was read". Whether the German is German, whether a translation is
right and whether a recording sounds correct are review gates, and they live in
`docs/human-review-gates.md`. No structural state here can close one, and a green
run must never be quoted as evidence of language quality.

**A unit may ship with review open.** `publishable` answers only the structural
question — an objective, recognition practice, production practice and resolved
media references. Review is reported separately and `counts as reviewed` stays
`no` until a named reviewer with a date and a scope says otherwise. Listening,
fresh retrieval and variety are warnings rather than absences that block a
release, because a course that halted on them could never ship anything as
partial A1.

**Absences warn; they do not fail the pack.** `npm run content:validate` still
passes for a course with listening in one lesson out of ten, which is the state
German ships in today. The contract states the absence and names it; the
editorial decision about what to author next belongs to the roadmap, not to a
build error.

`not-applicable` is only for cases where the item genuinely does not apply: the
first unit owes no prerequisites, the last unit cannot be retrieved by a later
one, and a course that authors no speaking anywhere is stating a position rather
than missing a check. It is never used as a softer word for `absent`.
