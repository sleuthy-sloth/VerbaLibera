# Audio content authoring guide

This guide explains how to add a new spoken pattern to VoxLibre without
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
`public/audio/{french,italian}/` together with a sha256 of both the text
and the WAV in the provenance JSON under `docs/audio-provenance/`.

Create a manifest entry in `services/voice/scripts/`:

```json
{
  "clips": [
    {
      "id": "<seed-id>-prompt",
      "text": "<prompt text from the fixture>",
      "language": "<fr|it>",
      "voice": "<ff_siwis|if_sara>",
      "filename": "<seed-id>-prompt.wav"
    },
    {
      "id": "<seed-id>-answer",
      "text": "<answer text from the fixture>",
      "language": "<fr|it>",
      "voice": "<ff_siwis|if_sara>",
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
`voxlibre-static-v2` cache. Bumping the cache version forces a refresh
on the next deploy.
