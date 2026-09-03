"""Transcribe every shipped lesson WAV with faster-whisper and compare to manifest text.

Not a substitute for native-speaker prosody judgment, but catches
wrong-word / dropped-word synthesis errors automatically.

Run from repo root with the voice venv (model downloads on first use):

    env -u PYTHONPATH services/voice/.venv/bin/python services/voice/scripts/stt_check.py
"""
from __future__ import annotations

import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
AUDIO_SUBDIRS = ("french-ordering", "french", "italian", "spanish")
MANIFEST_NAMES = (
    "french-ordering-pilot.json",
    "french-polish.json",
    "italian-patterns.json",
    "spanish-patterns.json",
    "french-expansion.json",
    "italian-expansion.json",
)
AUDIO_DIRS = [ROOT / "public" / "audio" / d for d in AUDIO_SUBDIRS]
MANIFESTS = [ROOT / "services" / "voice" / "scripts" / f for f in MANIFEST_NAMES]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return "".join(c if c.isalnum() or c.isspace() else " " for c in s).split().__str__()


def main() -> int:
    from faster_whisper import WhisperModel

    expected: dict[str, tuple[str, str]] = {}
    for m in MANIFESTS:
        for c in json.loads(m.read_text(encoding="utf-8"))["clips"]:
            expected[c["filename"]] = (c["text"], c["language"])

    models: dict[str, object] = {}
    ok = 0
    total = 0
    for d in AUDIO_DIRS:
        for wav in sorted(d.glob("*.wav")):
            text, lang = expected.get(wav.name, ("<unknown>", "fr"))
            if wav.name not in expected:
                print(f"?? {wav.name}: no manifest entry")
                continue
            if lang not in models:
                models[lang] = WhisperModel("small", device="cpu", compute_type="int8")
            segments, _info = models[lang].transcribe(str(wav), language=lang, beam_size=5)  # type: ignore[union-attr]
            heard = " ".join(s.text for s in segments).strip()
            total += 1
            match = norm(heard) == norm(text)
            ok += match
            flag = "OK " if match else "DIFF"
            print(f"{flag} {wav.name}\n     manifest: {text}\n     heard:    {heard}")
    print(f"\n{ok}/{total} clips match word-for-word (ignoring case/accents/punctuation)")
    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
