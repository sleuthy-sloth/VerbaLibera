# Original Audio and Voice Boundary Design

Date: 2026-09-01

Status: Approved for planning

## Objective

Make the two seeded A1 lesson demonstrations playable with original Kokoro-generated audio, without requiring a learner-facing Python service. At the same time, make the optional local voice sidecar installable and reject oversized transcription requests before multipart parsing can spool them.

## Scope

The delivered lesson assets are four short WAV clips:

| Course | Prompt | Answer |
| --- | --- | --- |
| English to French | Ask the learner how to order a coffee politely. | “Je voudrais un café, s’il vous plaît.” |
| English to Italian | Ask the learner how to order a coffee politely. | “Vorrei un caffè, per favore.” |

The clips are original model-generated instructional material. They are static public assets, referenced by fixture paths such as `/audio/fr-ordering-politely-prompt.wav`, and are played by the existing client-side `AudioPlayer`. They are not generated in response to a learner request and do not require the optional sidecar at runtime.

This work does not add browser microphone capture, automatic speech grading, persistence mutations, cloud TTS/STT, downloaded lesson packs, or a full authoring CMS.

## Architecture

### Audio authoring and playback

An operator-only Python command generates each authored clip through the existing `KokoroFasterWhisperEngine` TTS interface, writing a WAV file only to an explicit destination inside `public/audio/`. The command has a small authored manifest containing clip ID, target language, permitted voice, source text, and output filename. It rejects duplicate IDs, paths outside `public/audio/`, unsupported languages, and voices outside `VoiceServiceSettings`.

The command is intentionally separate from FastAPI: browser visitors cannot call it. The committed clips are reviewed like other original project assets and documented in `docs/asset-provenance.md` with generation date, text, language, voice, model/package version, and source command. Fixture URLs switch from `unavailable://` placeholders to these public paths. The learning screen supplies its selected concept’s mapped audio segments to `AudioPlayer`; while the prompt is playing, its transcript remains hidden. The response-turn action reveals/plays the answer only after the learner continues.

If an asset is absent or playback fails, the existing audio player error path remains visible and the learner can still continue through the transcript-preview fallback. No silent or synthetic placeholder is represented as lesson audio.

### Optional voice sidecar

The voice sidecar remains loopback-only and optional. Its test dependencies are split from model runtime dependencies so `pytest`, FastAPI, and multipart boundary tests install without Kokoro/faster-whisper model packages. The model runtime dependency uses a published, compatible Kokoro release verified against the existing `KPipeline` API; its exact version is documented with the generated clips. The runtime extra remains required only for starting `create_production_app` or generating clips.

`POST /transcribe` receives a Starlette request before multipart parameter parsing. It first rejects a declared content length over `max_audio_bytes + 64 KiB` with `413`, then streams the raw body through the same cap for chunked requests. Only the bounded byte buffer is converted into a fresh request and parsed as multipart. A stream/parsing failure remains a `400` malformed request; it must never be misreported as an oversized body. The existing file-size, MIME-type, language, engine-call, no-store, and no-persistence checks remain in force.

## Security and privacy constraints

- Learner audio is never logged, written to disk, or retained by application code.
- The static lesson clips contain only the four original authored utterances and are public by design.
- The browser never learns the sidecar URL or Kokoro model configuration.
- The sidecar has no public learner-TTS endpoint; `POST /tts` remains an operator authoring endpoint.
- The raw multipart request cap is `max_audio_bytes + 65,536` bytes, which permits multipart framing while retaining the 1,000,000-byte default audio limit.
- Generated WAV assets must be committed only after listening/review and provenance documentation.

## Testing and verification

- Fixture tests assert four public local audio URLs, expected prompt/answer ordering, and no `unavailable://` URLs for seeded courses.
- Component tests prove a playable prompt pauses before answer playback and the answer transcript is not rendered until the learner completes the response turn.
- The learning page test proves the selected course mounts `AudioPlayer` with the authored assets and retains its transcript fallback for unavailable playback.
- Python tests prove oversized declared and chunked multipart requests return `413` before the multipart parser/spooler is invoked; interrupted streams return `400`; valid supported uploads retain current results.
- Voice test installation uses the lightweight dependency set. An opt-in model smoke test and generation command are run only with installed Kokoro runtime and configured local models.
- Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run prisma:validate`, and the Python contract suite before publication. Document any unavailable local model runtime rather than claiming a model smoke test passed.

## Acceptance criteria

- The French and Italian demo lesson each have an original, playable prompt and answer clip in `public/audio/`.
- The dashboard-to-session flow presents the audio player for a renderable session and lets the learner start, think indefinitely, continue, and hear the answer.
- A missing clip is visible as an error/unavailable state, never as a successful playback completion.
- The Python service test environment installs without model packages, and its raw request boundary prevents multipart spooling of oversized uploads.
- The optional runtime has a documented, resolvable Kokoro package version; no unsupported `kokoro==0.9.4` pin remains.
