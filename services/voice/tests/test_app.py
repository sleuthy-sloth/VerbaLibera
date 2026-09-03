from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from services.voice.app import create_app
from services.voice.service.contracts import VoiceServiceSettings
from services.voice.service.engines import (
    KokoroFasterWhisperEngine,
    LocalModelSettings,
)


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


def test_transcribe_rejects_an_oversized_request_before_multipart_spooling(
    client: TestClient, fake_engine: FakeVoiceEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Break caught: framework multipart parsing writes a too-large learner recording to disk.
    import starlette.formparsers

    def unexpected_spool(*args: object, **kwargs: object) -> object:
        raise AssertionError("multipart spooling must not occur before the request is bounded")

    monkeypatch.setattr(starlette.formparsers, "SpooledTemporaryFile", unexpected_spool)

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


def test_transcribe_accepts_a_supported_mime_essence_with_parameters(
    client: TestClient, fake_engine: FakeVoiceEngine
) -> None:
    # Break caught: standard browser WebM codec parameters cause a valid response to be rejected.
    response = client.post(
        "/transcribe",
        files={
            "audio": (
                "answer.webm",
                b"voice",
                "audio/webm;codecs=opus",
            )
        },
        data={"language": "fr"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "transcript": "Vorrei un caffè."}


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


def test_kokoro_adapter_combines_all_audio_chunks_before_wav_encoding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Break caught: only the first chunk of a long Kokoro utterance reaches the authored clip.
    encoded_audio: list[list[bytes]] = []

    def write(output: object, audio: list[bytes], samplerate: int, format: str) -> None:
        assert samplerate == 24_000
        assert format == "WAV"
        encoded_audio.append(audio)
        output.write(b"".join(audio))  # type: ignore[attr-defined]

    monkeypatch.setitem(sys.modules, "soundfile", SimpleNamespace(write=write))
    engine = object.__new__(KokoroFasterWhisperEngine)
    monkeypatch.setattr(
        engine,
        "_pipeline_for",
        lambda language: lambda text, voice: iter(
            [
                ("first", "", [b"first-"]),
                ("second", "", [b"second"]),
            ]
        ),
    )

    result = engine.synthesize("Bonjour", "fr", "ff_siwis")

    assert encoded_audio == [[b"first-", b"second"]]
    assert result == b"first-second"


def test_kokoro_adapter_configures_operator_espeak_before_pipeline_construction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Break caught: the macOS espeakng-loader wheel opens its broken bundled
    # library before the operator's maintained system eSpeak paths are applied.
    events: list[tuple[str, str]] = []

    class FakeEspeakWrapper:
        @classmethod
        def set_library(cls, value: str) -> None:
            events.append(("library", value))

        @classmethod
        def set_data_path(cls, value: str) -> None:
            events.append(("data", value))

    class FakePipeline:
        def __init__(self, lang_code: str, **options: str) -> None:
            assert lang_code == "f"
            assert options == {}
            events.append(("pipeline", lang_code))

    monkeypatch.setitem(sys.modules, "kokoro", SimpleNamespace(KPipeline=FakePipeline))
    monkeypatch.setitem(
        sys.modules,
        "phonemizer.backend.espeak.wrapper",
        SimpleNamespace(EspeakWrapper=FakeEspeakWrapper),
    )
    engine = object.__new__(KokoroFasterWhisperEngine)
    engine._pipelines = {}
    engine._model_settings = LocalModelSettings.from_environment(
        {
            "PHONEMIZER_ESPEAK_LIBRARY": "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib",
            "PHONEMIZER_ESPEAK_DATA_PATH": "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data",
        }
    )

    result = engine._pipeline_for("fr")

    assert isinstance(result, FakePipeline)
    assert events == [
        ("library", "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib"),
        ("data", "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data"),
        ("pipeline", "f"),
    ]


def test_spanish_voice_is_permitted_by_default() -> None:
    settings = VoiceServiceSettings.from_environment({})
    assert settings.permits_voice("es", "ef_dora")
    assert not settings.permits_voice("es", "ff_siwis")


def test_spanish_voice_override_from_environment() -> None:
    settings = VoiceServiceSettings.from_environment(
        {"VOXLIBRE_VOICE_SPANISH_VOICES": "em_alex,em_santa"}
    )
    assert settings.permits_voice("es", "em_alex")
    assert not settings.permits_voice("es", "ef_dora")


def test_kokoro_adapter_builds_spanish_pipeline_with_e_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[tuple[str, str]] = []

    class FakeEspeakWrapper:
        @classmethod
        def set_library(cls, value: str) -> None:
            events.append(("library", value))

        @classmethod
        def set_data_path(cls, value: str) -> None:
            events.append(("data", value))

    class FakePipeline:
        def __init__(self, lang_code: str, **options: str) -> None:
            assert lang_code == "e"
            assert options == {}
            events.append(("pipeline", lang_code))

    monkeypatch.setitem(sys.modules, "kokoro", SimpleNamespace(KPipeline=FakePipeline))
    monkeypatch.setitem(
        sys.modules,
        "phonemizer.backend.espeak.wrapper",
        SimpleNamespace(EspeakWrapper=FakeEspeakWrapper),
    )
    engine = object.__new__(KokoroFasterWhisperEngine)
    engine._pipelines = {}
    engine._model_settings = LocalModelSettings.from_environment(
        {
            "PHONEMIZER_ESPEAK_LIBRARY": "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib",
            "PHONEMIZER_ESPEAK_DATA_PATH": "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data",
        }
    )

    result = engine._pipeline_for("es")

    assert isinstance(result, FakePipeline)
    assert events == [
        ("library", "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib"),
        ("data", "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data"),
        ("pipeline", "e"),
    ]


def test_portuguese_voice_is_permitted_by_default() -> None:
    settings = VoiceServiceSettings.from_environment({})
    assert settings.permits_voice("pt", "pf_dora")
    assert not settings.permits_voice("pt", "ef_dora")


def test_portuguese_voice_override_from_environment() -> None:
    settings = VoiceServiceSettings.from_environment(
        {"VOXLIBRE_VOICE_PORTUGUESE_VOICES": "pm_alex,pm_santa"}
    )
    assert settings.permits_voice("pt", "pm_alex")
    assert not settings.permits_voice("pt", "pf_dora")


def test_kokoro_adapter_builds_portuguese_pipeline_with_p_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[tuple[str, str]] = []

    class FakeEspeakWrapper:
        @classmethod
        def set_library(cls, value: str) -> None:
            events.append(("library", value))

        @classmethod
        def set_data_path(cls, value: str) -> None:
            events.append(("data", value))

    class FakePipeline:
        def __init__(self, lang_code: str, **options: str) -> None:
            assert lang_code == "p"
            assert options == {}
            events.append(("pipeline", lang_code))

    monkeypatch.setitem(sys.modules, "kokoro", SimpleNamespace(KPipeline=FakePipeline))
    monkeypatch.setitem(
        sys.modules,
        "phonemizer.backend.espeak.wrapper",
        SimpleNamespace(EspeakWrapper=FakeEspeakWrapper),
    )
    engine = object.__new__(KokoroFasterWhisperEngine)
    engine._pipelines = {}
    engine._model_settings = LocalModelSettings.from_environment(
        {
            "PHONEMIZER_ESPEAK_LIBRARY": "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib",
            "PHONEMIZER_ESPEAK_DATA_PATH": "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data",
        }
    )

    result = engine._pipeline_for("pt")

    assert isinstance(result, FakePipeline)
    assert events == [
        ("library", "/opt/homebrew/opt/espeak-ng/lib/libespeak-ng.dylib"),
        ("data", "/opt/homebrew/opt/espeak-ng/share/espeak-ng-data"),
        ("pipeline", "p"),
    ]
