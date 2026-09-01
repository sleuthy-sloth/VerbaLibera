"""Kokoro/faster-whisper adapters for an operator-managed local process."""

from __future__ import annotations

import io
import os
from collections.abc import Mapping
from dataclasses import dataclass
from threading import BoundedSemaphore

from .contracts import VoiceServiceSettings


@dataclass(frozen=True)
class LocalModelSettings:
    """Model selection stays local to the sidecar and never reaches browser code."""

    kokoro_model_path: str | None
    whisper_model_name: str
    whisper_model_path: str | None
    whisper_device: str
    whisper_compute_type: str

    @classmethod
    def from_environment(
        cls, environment: Mapping[str, str] | None = None
    ) -> "LocalModelSettings":
        env = os.environ if environment is None else environment
        return cls(
            kokoro_model_path=env.get("VOXLIBRE_KOKORO_MODEL_PATH") or None,
            whisper_model_name=env.get("VOXLIBRE_FASTER_WHISPER_MODEL", "small"),
            whisper_model_path=env.get("VOXLIBRE_FASTER_WHISPER_MODEL_PATH") or None,
            whisper_device=env.get("VOXLIBRE_FASTER_WHISPER_DEVICE", "cpu"),
            whisper_compute_type=env.get(
                "VOXLIBRE_FASTER_WHISPER_COMPUTE_TYPE", "int8"
            ),
        )


class KokoroFasterWhisperEngine:
    """Loads local models once and keeps every request's audio in process memory."""

    _KOKORO_LANGUAGE_CODES = {"fr": "f", "it": "i"}

    def __init__(
        self,
        service_settings: VoiceServiceSettings,
        model_settings: LocalModelSettings,
    ) -> None:
        # These imports intentionally happen only in the opt-in service process.
        from faster_whisper import WhisperModel

        self._service_settings = service_settings
        self._model_settings = model_settings
        self._whisper = WhisperModel(
            model_settings.whisper_model_path or model_settings.whisper_model_name,
            device=model_settings.whisper_device,
            compute_type=model_settings.whisper_compute_type,
        )
        self._pipelines: dict[str, object] = {}
        self._transcription_slots = BoundedSemaphore(value=1)

    @classmethod
    def from_environment(cls) -> "KokoroFasterWhisperEngine":
        return cls(
            VoiceServiceSettings.from_environment(), LocalModelSettings.from_environment()
        )

    def health(self) -> dict[str, object]:
        return {
            "status": "ok",
            "languages": sorted(self._service_settings.permitted_languages),
            "voices": sorted(
                voice
                for voices in self._service_settings.permitted_voices.values()
                for voice in voices
            ),
        }

    def synthesize(self, text: str, language: str, voice: str) -> bytes:
        """Return a WAV clip for authorized authored material without writing a file."""
        import soundfile as sound_file

        pipeline = self._pipeline_for(language)
        output = io.BytesIO()
        chunks: list[bytes] = []
        for _, _, audio in pipeline(text, voice=voice):
            chunks.extend(audio)
        if not chunks:
            raise RuntimeError("Kokoro did not return audio for the authored text.")
        sound_file.write(output, chunks, 24_000, format="WAV")
        return output.getvalue()

    def transcribe(self, audio: bytes, language: str) -> str | None:
        """Transcribe from an in-memory stream; no learner recording is written by this app."""
        with self._transcription_slots:
            segments, _ = self._whisper.transcribe(
                io.BytesIO(audio), language=language, vad_filter=True
            )
            transcript = " ".join(segment.text.strip() for segment in segments).strip()
        return transcript or None

    def _pipeline_for(self, language: str):
        if language not in self._pipelines:
            from kokoro import KPipeline

            options: dict[str, str] = {}
            if self._model_settings.kokoro_model_path:
                options["repo_id"] = self._model_settings.kokoro_model_path
            self._pipelines[language] = KPipeline(
                lang_code=self._KOKORO_LANGUAGE_CODES[language], **options
            )
        return self._pipelines[language]
