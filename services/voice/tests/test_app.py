from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from services.voice.app import create_app


class FakeVoiceEngine:
    """In-memory engine used to verify that request validation happens first."""

    def __init__(self) -> None:
        self.transcribe_calls = 0
        self.synthesize_calls = 0
        self.transcript: str | None = "Vorrei un caffè."

    def health(self) -> dict[str, object]:
        return {
            "status": "ok",
            "languages": ["fr", "it"],
            "voices": ["af_heart"],
        }

    def synthesize(self, text: str, language: str, voice: str) -> bytes:
        self.synthesize_calls += 1
        return b"RIFF" + text.encode("utf-8")

    def transcribe(self, audio: bytes, language: str) -> str | None:
        self.transcribe_calls += 1
        return self.transcript


@pytest.fixture
def fake_engine() -> FakeVoiceEngine:
    return FakeVoiceEngine()


@pytest.fixture
def client(fake_engine: FakeVoiceEngine) -> TestClient:
    return TestClient(create_app(fake_engine))


def test_health_returns_only_capability_metadata(client: TestClient) -> None:
    # Break caught: health leaks service internals instead of stable availability metadata.
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "languages": ["fr", "it"],
        "voices": ["af_heart"],
    }


def test_transcribe_rejects_oversized_audio_without_calling_engine(
    client: TestClient, fake_engine: FakeVoiceEngine
) -> None:
    # Break caught: oversized learner recordings reach a local model process.
    response = client.post(
        "/transcribe",
        files={"audio": ("answer.webm", b"x" * 1_000_001, "audio/webm")},
        data={"language": "fr"},
    )

    assert response.status_code == 413
    assert fake_engine.transcribe_calls == 0


def test_transcribe_returns_only_transient_final_text(client: TestClient) -> None:
    # Break caught: transient transcription responses gain persisted-recording metadata.
    response = client.post(
        "/transcribe",
        files={"audio": ("answer.webm", b"voice", "audio/webm")},
        data={"language": "it"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "transcript": "Vorrei un caffè."}


def test_transcribe_rejects_an_unsupported_language(
    client: TestClient, fake_engine: FakeVoiceEngine
) -> None:
    # Break caught: transcription runs without an authored course-language boundary.
    response = client.post(
        "/transcribe",
        files={"audio": ("answer.webm", b"voice", "audio/webm")},
        data={"language": "de"},
    )

    assert response.status_code == 422
    assert fake_engine.transcribe_calls == 0


def test_transcribe_rejects_an_unsupported_mime_type(
    client: TestClient, fake_engine: FakeVoiceEngine
) -> None:
    # Break caught: arbitrary files are accepted as learner microphone recordings.
    response = client.post(
        "/transcribe",
        files={"audio": ("answer.mp3", b"voice", "audio/mpeg")},
        data={"language": "fr"},
    )

    assert response.status_code == 415
    assert fake_engine.transcribe_calls == 0


def test_transcribe_returns_no_speech_without_a_transcript(
    client: TestClient, fake_engine: FakeVoiceEngine
) -> None:
    # Break caught: an empty model result is incorrectly represented as a learner transcript.
    fake_engine.transcript = None

    response = client.post(
        "/transcribe",
        files={"audio": ("answer.wav", b"voice", "audio/wav")},
        data={"language": "fr"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "no_speech"}


def test_tts_rejects_an_unpermitted_voice_without_calling_engine(
    client: TestClient, fake_engine: FakeVoiceEngine
) -> None:
    # Break caught: arbitrary voices can be generated through the operator authoring endpoint.
    response = client.post(
        "/tts",
        json={"text": "Bonjour", "language": "fr", "voice": "unlisted"},
    )

    assert response.status_code == 422
    assert fake_engine.synthesize_calls == 0
