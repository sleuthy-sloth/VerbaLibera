# Optional local voice companion

VoxLibre works fully with touch and keyboard controls. This companion is an optional,
self-hosted service for two local-only capabilities:

- **Kokoro** produces reviewable, original model-audio clips during course authoring.
- **faster-whisper** transcribes a short learner response after the learner explicitly
  starts recording.

There is no cloud speech fallback. If the service is unavailable, the app reports voice
as unavailable and the normal non-voice lesson path remains available.

## Requirements

- Python 3.10 or newer is recommended for the pinned Kokoro and faster-whisper runtime.
- A local CPU installation works with the default `cpu` + `int8` faster-whisper settings.
- CUDA hosts can opt in with a compatible CTranslate2/CUDA setup and a CUDA compute type;
  verify that configuration independently before enabling it for a shared deployment.

Create the service environment from the repository root:

```bash
python3 -m venv services/voice/.venv
services/voice/.venv/bin/pip install -r services/voice/requirements.txt
```

The first production start may download the configured Kokoro and faster-whisper model
artifacts (or use the paths you provide). Those model caches are distinct from learner
audio and transcripts.

## Configuration and start

The Next.js server is the only caller of this service. Set its endpoint to the local,
trusted sidecar URL:

```bash
export VOXLIBRE_VOICE_SERVICE_URL=http://127.0.0.1:8090
```

Configure the sidecar with these exact environment variables. Defaults are shown where
they exist.

```bash
export VOXLIBRE_VOICE_LANGUAGES=fr,it
export VOXLIBRE_VOICE_ACCEPTED_MIME_TYPES=audio/webm,audio/wav
export VOXLIBRE_VOICE_MAX_AUDIO_BYTES=1000000
export VOXLIBRE_VOICE_FRENCH_VOICES=ff_siwis
export VOXLIBRE_VOICE_ITALIAN_VOICES=if_sara

# Leave empty to use the Kokoro package's configured model source.
export VOXLIBRE_KOKORO_MODEL_PATH=/absolute/path/to/kokoro-model

# Either point at a previously downloaded model directory or use a model name.
export VOXLIBRE_FASTER_WHISPER_MODEL=small
export VOXLIBRE_FASTER_WHISPER_MODEL_PATH=/absolute/path/to/faster-whisper-model
export VOXLIBRE_FASTER_WHISPER_DEVICE=cpu
export VOXLIBRE_FASTER_WHISPER_COMPUTE_TYPE=int8
```

Unset optional path variables rather than setting them to a fake path. Start the
factory-based application from the repository root:

```bash
services/voice/.venv/bin/uvicorn services.voice.app:create_production_app --factory --host 127.0.0.1 --port 8090
```

Keep the service bound to loopback unless it is protected by a deliberate self-hosted
deployment boundary. `POST /tts` is an operator authoring endpoint, not a browser lesson
endpoint. It accepts only configured languages and voices and returns generated audio
without saving it.

## Privacy and learner controls

Recording starts only after an explicit browser action. The Next.js route and Python
service accept only `audio/webm` or `audio/wav`, cap a response at 1,000,000 bytes by
default, and return only a final transcript/status. Neither application layer writes raw
learner recordings or transcripts to disk, logs request-body content, or stores learner
voice data by default. A transcript is transient input for the current authored answer
check; it is not a pronunciation score or account record.

Learners can deny microphone permission, skip recording, or continue with touch/keyboard
at every point. No voice error changes an SRS result, XP, or progression.

Installing VoxLibre as a PWA does **not** run Python models on a learner's phone. The
service is for a developer machine or an intentionally self-hosted server alongside the
web app. A truly device-local mobile model needs separate native/browser-runtime,
download, consent, and hardware-budget work.

## Verification note

The committed contract tests use an injected in-memory fake engine, so they do not
download model weights or need microphone hardware. Run a local model smoke test only
after installing model dependencies and providing compatible local weights/hardware; it
is intentionally deferred from the default test suite.
