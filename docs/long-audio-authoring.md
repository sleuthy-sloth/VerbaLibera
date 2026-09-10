# Long guided audio: continuation workflow

The initial Spanish, Brazilian Portuguese, and German expansion adds two text lessons per course (introductions and café requests) and one approximately ten-minute guided recording per course. Existing first-lesson IDs and completion records remain usable. Course manifests are the authored source; `npm run content:build` updates downloadable packs.

## One script, two outputs

Author `services/voice/scripts/<language>-introductions-listen.lesson.json`. Each section contains a unique heading, English `teacher` narration, an optional target-language `target` with `text` and English `meaning`, and an optional `thinkSeconds` pause. Playback order is narration, thinking pause, target-language reveal, then a short transition. A model must precede a retrieval prompt. Introduce new words explicitly; do not assume a word was taught merely because it exists elsewhere in the course.

The English narrator speaks English. Target-language expressions are separate clips with the correct language voice. Portuguese examples use Brazilian usage. German uses a German Piper model, not a Kokoro voice pretending to speak German.

`services/voice/scripts/build_listen_track.py` produces:

- A static MP3 under `public/audio/<language>-foundations/`.
- A transcript and measured duration under `src/features/listen/generated/`.
- Ordered speech/pause events, source and audio digests, engine versions, and clip provenance under `docs/audio-provenance/`.

The app never loads these synthesis models. It plays the authored MP3. New recordings are registered in `src/features/listen/tracks.ts`.

## Rebuild locally

Use the existing voice Python environment with Kokoro 0.9.4, NumPy, SoundFile, and ffmpeg/ffprobe. For German, install the optional authoring dependency `piper-tts==1.3.0` in an authoring environment and provide `de_DE-thorsten-medium.onnx` plus its adjacent `.onnx.json`. The model used here is from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/de/de_DE/thorsten/medium); the Python synthesis API follows [Piper's documentation](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md). Keep model files and temporary clips outside the repository.

From the repository root:

```sh
PHONEMIZER_ESPEAK_LIBRARY=/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib \
PHONEMIZER_ESPEAK_DATA_PATH=/opt/homebrew/opt/espeak-ng/share/espeak-ng-data \
services/voice/.venv/bin/python services/voice/scripts/build_listen_track.py \
  services/voice/scripts/spanish-introductions-listen.lesson.json \
  --cache /tmp/verbalibera-listen-clips
```

Use the Portuguese or German source filename for the other languages. German also requires `--piper-model /path/to/de_DE-thorsten-medium.onnx`. The CLI validates voice/language pairings, rejects empty/silent synthesis, resamples to 24 kHz mono, and caches clips by speech content and engine identity. When changing a script, regenerate the recording and transcript together. Never edit the generated transcript alone.

## Verification and review

Run the authoring unit tests, content build, typecheck, Listen tests, and browser playback tests:

```sh
services/voice/.venv/bin/python -m unittest discover -s services/voice/tests -p test_build_listen_track.py
npm run content:build
npm run typecheck
npx vitest run tests/ListenAudio.test.tsx tests/course-pack.test.ts tests/service-worker.test.ts
npx playwright test tests/e2e/listen.spec.ts --grep 'long audio' --workers=1
```

Automated waveform, digest, decoding, and transcription checks do not establish natural pronunciation or native-level editorial quality. Keep that review status explicit. Check every transcription discrepancy against the audio rather than changing correct language to satisfy speech recognition.

## Current limits and next batch

The “Save audio” link lets learners save the MP3 for playback outside the app. Dedicated Listen navigation is not yet available after a fresh offline app launch, and these new standalone tracks are not embedded in the portable course HTML. Do not claim that downloading the text course installs this standalone listening experience. The next implementation should add a shared audio catalog to the offline workspace and a first-class pack reference for standalone tracks, rather than disguising a ten-minute recording as a dictation exercise.

Continue with numbers and quantities, then everyday directions, reusing the same teach–predict–reveal structure. Expand beyond the first three lessons before claiming full A1 coverage. Native-speaker editorial and prosody review remains open for this initial batch.
