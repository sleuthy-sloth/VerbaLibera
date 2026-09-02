from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from services.voice.app import create_app
from services.voice.service.contracts import TranslationServiceSettings


class FakeTranslateEngine:
    """Records translate calls and returns a canned response."""

    def __init__(self, translation: str = "Hello") -> None:
        self.translation = translation
        self.calls: list[tuple[str, str, str]] = []
        self.raise_on_call = False

    def translate(self, text: str, source: str, target: str) -> str:
        if self.raise_on_call:
            raise RuntimeError("translation failed")
        self.calls.append((text, source, target))
        return f"{self.translation} ({source}->{target})"


class RaisingTranslateEngine:
    """Simulates an engine that fails at runtime."""

    def translate(self, text: str, source: str, target: str) -> str:
        raise RuntimeError("translation failed")


@pytest.fixture
def translation_settings() -> TranslationServiceSettings:
    return TranslationServiceSettings()


@pytest.fixture
def translate_engine() -> FakeTranslateEngine:
    return FakeTranslateEngine()


@pytest.fixture
def client_with_translation(
    translate_engine: FakeTranslateEngine,
    translation_settings: TranslationServiceSettings,
) -> TestClient:
    return TestClient(
        create_app(
            FakeVoiceEngine(),
            translate_engine=translate_engine,
            translation_settings=translation_settings,
        )
    )


class FakeVoiceEngine:
    """Minimal voice engine so create_app can be wired for translation tests."""

    def health(self) -> dict[str, object]:
        return {"status": "ok", "languages": ["fr", "it"], "voices": ["af_heart"]}

    def synthesize(self, text: str, language: str, voice: str) -> bytes:
        return b"RIFF"

    def transcribe(self, audio: bytes, language: str) -> str | None:
        return None


def test_translate_valid_pair_returns_translation_with_no_store(
    client_with_translation: TestClient,
    translate_engine: FakeTranslateEngine,
) -> None:
    response = client_with_translation.post(
        "/translate",
        json={"text": "Bonjour", "source": "fr", "target": "en"},
    )

    assert response.status_code == 200
    assert response.json() == {"translation": "Hello (fr->en)"}
    assert response.headers["Cache-Control"] == "no-store"
    assert translate_engine.calls == [("Bonjour", "fr", "en")]


def test_translate_rejects_unsupported_source_target_pair(
    client_with_translation: TestClient,
    translate_engine: FakeTranslateEngine,
) -> None:
    response = client_with_translation.post(
        "/translate",
        json={"text": "Hello", "source": "en", "target": "fr"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Unsupported language pair."
    assert translate_engine.calls == []


def test_translate_rejects_same_source_and_target(
    client_with_translation: TestClient,
    translate_engine: FakeTranslateEngine,
) -> None:
    response = client_with_translation.post(
        "/translate",
        json={"text": "Bonjour", "source": "fr", "target": "fr"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Unsupported language pair."
    assert translate_engine.calls == []


def test_translate_rejects_text_over_max_length(
    client_with_translation: TestClient,
    translate_engine: FakeTranslateEngine,
) -> None:
    response = client_with_translation.post(
        "/translate",
        json={"text": "x" * 2001, "source": "fr", "target": "en"},
    )

    assert response.status_code == 422
    assert translate_engine.calls == []


def test_translate_rejects_empty_text(
    client_with_translation: TestClient,
    translate_engine: FakeTranslateEngine,
) -> None:
    response = client_with_translation.post(
        "/translate",
        json={"text": "", "source": "fr", "target": "en"},
    )

    assert response.status_code == 422
    assert translate_engine.calls == []


def test_translate_returns_503_when_engine_raises(
    translation_settings: TranslationServiceSettings,
) -> None:
    client = TestClient(
        create_app(
            FakeVoiceEngine(),
            translate_engine=RaisingTranslateEngine(),
            translation_settings=translation_settings,
        )
    )

    response = client.post(
        "/translate",
        json={"text": "Bonjour", "source": "fr", "target": "en"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Local translation is unavailable."


def test_translate_returns_503_when_no_engine_configured(
    translation_settings: TranslationServiceSettings,
) -> None:
    client = TestClient(
        create_app(
            FakeVoiceEngine(),
            translation_settings=translation_settings,
        )
    )

    response = client.post(
        "/translate",
        json={"text": "Bonjour", "source": "fr", "target": "en"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Local translation is unavailable."


def test_health_reports_translation_available_and_pairs(
    client_with_translation: TestClient,
) -> None:
    response = client_with_translation.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["translation"] == {
        "available": True,
        "pairs": ["fr-en", "it-en"],
    }


def test_health_reports_translation_unavailable_without_engine(
    translation_settings: TranslationServiceSettings,
) -> None:
    client = TestClient(
        create_app(
            FakeVoiceEngine(),
            translation_settings=translation_settings,
        )
    )

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["translation"] == {
        "available": False,
        "pairs": ["fr-en", "it-en"],
    }
