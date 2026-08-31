"""Explicit contracts and configuration for VoxLibre's optional voice sidecar."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

SUPPORTED_LANGUAGES = frozenset({"fr", "it"})
ACCEPTED_AUDIO_TYPES = frozenset({"audio/webm", "audio/wav"})
DEFAULT_MAX_AUDIO_BYTES = 1_000_000


class VoiceEngine(Protocol):
    """In-memory-only model operations used by the HTTP application."""

    def health(self) -> dict[str, object]:
        """Return capability metadata only; do not include model paths or secrets."""

    def synthesize(self, text: str, language: str, voice: str) -> bytes:
        """Generate a transient authored audio clip."""

    def transcribe(self, audio: bytes, language: str) -> str | None:
        """Return a final transcript for a short learner response, if any."""


def _csv(value: str) -> frozenset[str]:
    return frozenset(item.strip() for item in value.split(",") if item.strip())


def _max_audio_bytes(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise ValueError("VOXLIBRE_VOICE_MAX_AUDIO_BYTES must be greater than zero.")
    return parsed


@dataclass(frozen=True)
class VoiceServiceSettings:
    """Environment-backed request bounds for the trusted, local service process."""

    permitted_languages: frozenset[str]
    accepted_audio_types: frozenset[str]
    max_audio_bytes: int
    permitted_voices: Mapping[str, frozenset[str]]

    @classmethod
    def from_environment(
        cls, environment: Mapping[str, str] | None = None
    ) -> "VoiceServiceSettings":
        env = os.environ if environment is None else environment
        languages = _csv(env.get("VOXLIBRE_VOICE_LANGUAGES", "fr,it"))
        return cls(
            permitted_languages=languages,
            accepted_audio_types=_csv(
                env.get("VOXLIBRE_VOICE_ACCEPTED_MIME_TYPES", "audio/webm,audio/wav")
            ),
            max_audio_bytes=_max_audio_bytes(
                env.get("VOXLIBRE_VOICE_MAX_AUDIO_BYTES", str(DEFAULT_MAX_AUDIO_BYTES))
            ),
            permitted_voices={
                "fr": _csv(env.get("VOXLIBRE_VOICE_FRENCH_VOICES", "ff_siwis")),
                "it": _csv(env.get("VOXLIBRE_VOICE_ITALIAN_VOICES", "if_sara")),
            },
        )

    def permits_voice(self, language: str, voice: str) -> bool:
        return voice in self.permitted_voices.get(language, frozenset())
