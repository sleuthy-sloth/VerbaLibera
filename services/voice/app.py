"""HTTP boundary for VoxLibre's optional, self-hosted voice capabilities."""

from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from services.voice.service.contracts import VoiceEngine, VoiceServiceSettings
from services.voice.service.engines import KokoroFasterWhisperEngine


class TtsRequest(BaseModel):
    """Operator-authored TTS request. It is deliberately not a learner browser endpoint."""

    text: str = Field(min_length=1, max_length=2_000)
    language: str
    voice: str


def create_app(
    engine: VoiceEngine, settings: VoiceServiceSettings | None = None
) -> FastAPI:
    """Create a testable FastAPI app without coupling it to production model loading."""
    service_settings = settings or VoiceServiceSettings.from_environment()
    app = FastAPI(title="VoxLibre local voice service", docs_url=None, redoc_url=None)

    @app.middleware("http")
    async def bound_transcribe_body(request: Request, call_next):
        """Enforce the audio byte bound before multipart parsing spools anything.

        The bound is applied to the raw ASGI request body for POST /transcribe only.
        Multipart framing overhead counts against the learner's byte budget, so any
        request whose total body exceeds ``max_audio_bytes`` is rejected with 413
        before Starlette creates a ``SpooledTemporaryFile``. Other routes are not
        affected.
        """
        if request.method != "POST" or request.url.path != "/transcribe":
            return await call_next(request)

        body = b""
        max_bytes = service_settings.max_audio_bytes
        while True:
            message = await request.receive()
            if message["type"] != "http.request":
                break
            chunk = message.get("body", b"")
            body += chunk
            if len(body) > max_bytes:
                return JSONResponse(
                    {"detail": "Audio request is too large."},
                    status_code=413,
                    headers={"Cache-Control": "no-store"},
                )
            if not message.get("more_body", False):
                break

        async def replay_receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request._receive = replay_receive
        return await call_next(request)

    @app.get("/health")
    def health() -> dict[str, object]:
        try:
            return engine.health()
        except Exception:
            return {"status": "unavailable", "languages": [], "voices": []}

    @app.post("/tts")
    def synthesize(request: TtsRequest) -> Response:
        if request.language not in service_settings.permitted_languages:
            raise HTTPException(status_code=422, detail="Unsupported language.")
        if not service_settings.permits_voice(request.language, request.voice):
            raise HTTPException(status_code=422, detail="Unsupported voice.")

        try:
            audio = engine.synthesize(request.text, request.language, request.voice)
        except Exception as error:
            raise HTTPException(status_code=503, detail="Local TTS is unavailable.") from error

        return Response(
            content=audio,
            media_type="audio/wav",
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/transcribe")
    async def transcribe(
        audio: UploadFile = File(...), language: str = Form(...)
    ) -> JSONResponse:
        if language not in service_settings.permitted_languages:
            raise HTTPException(status_code=422, detail="Unsupported language.")
        mime_essence = (audio.content_type or "").split(";", 1)[0].strip().lower()
        if mime_essence not in service_settings.accepted_audio_types:
            raise HTTPException(status_code=415, detail="Unsupported audio type.")

        try:
            audio_bytes = await audio.read(service_settings.max_audio_bytes + 1)
        finally:
            await audio.close()

        if len(audio_bytes) > service_settings.max_audio_bytes:
            raise HTTPException(status_code=413, detail="Audio response is too large.")

        try:
            transcript = engine.transcribe(audio_bytes, language)
        except Exception:
            return JSONResponse(
                {"status": "unavailable"},
                status_code=503,
                headers={"Cache-Control": "no-store"},
            )

        if transcript is None:
            return JSONResponse(
                {"status": "no_speech"}, headers={"Cache-Control": "no-store"}
            )
        return JSONResponse(
            {"status": "ok", "transcript": transcript},
            headers={"Cache-Control": "no-store"},
        )

    return app


def create_production_app() -> FastAPI:
    """Factory used by Uvicorn after the operator has configured local model access."""
    return create_app(KokoroFasterWhisperEngine.from_environment())
