"""Tests for services/voice/scripts/reconcile_provenance.py.

Task 9: provenance must always reflect the WAVs on disk. These tests
exercise the helper directly without needing the Kokoro sidecar.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "services" / "voice" / "scripts" / "reconcile_provenance.py"


def _load():
    spec = importlib.util.spec_from_file_location("reconcile_provenance", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["reconcile_provenance"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_reconcile_succeeds_against_current_repo():
    mod = _load()
    rc = mod.main()
    assert rc == 0, "reconcile_provenance must pass against the current repo"


def test_build_provenance_round_trip(tmp_path, monkeypatch):
    """build_provenance should write JSON that matches the WAV bytes on disk."""
    mod = _load()

    audio_dir = tmp_path / "public" / "audio" / "italian"
    audio_dir.mkdir(parents=True)
    (audio_dir / "it-foo-prompt.wav").write_bytes(b"prompt-bytes")
    (audio_dir / "it-foo-answer.wav").write_bytes(b"answer-bytes")

    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "clips": [
                    {
                        "id": "it-foo-prompt",
                        "text": "Ciao",
                        "language": "it",
                        "voice": "if_sara",
                        "filename": "it-foo-prompt.wav",
                    },
                    {
                        "id": "it-foo-answer",
                        "text": "Buongiorno",
                        "language": "it",
                        "voice": "if_sara",
                        "filename": "it-foo-answer.wav",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    prov_path = tmp_path / "docs" / "audio-provenance" / "it-foo.json"
    prov_path.parent.mkdir(parents=True)

    monkeypatch.setattr(mod, "AUDIO_DIR", tmp_path / "public" / "audio")
    monkeypatch.setattr(mod, "PROV_DIR", tmp_path / "docs" / "audio-provenance")

    prov = mod.build_provenance(
        {
            "path": prov_path,
            "manifest": manifest,
            "audio_subdir": "italian",
        }
    )

    assert all(len(c["audio_sha256"]) == 64 for c in prov["clips"])
    assert all(len(c["text_sha256"]) == 64 for c in prov["clips"])
    assert all(c["bytes"] for c in prov["clips"])
    # And the hash for the arbitrary bytes matches what we wrote
    import hashlib
    assert prov["clips"][0]["audio_sha256"] == hashlib.sha256(b"prompt-bytes").hexdigest()


def test_reconcile_refuses_missing_wav(tmp_path, monkeypatch, capsys):
    """If a manifest references a WAV that does not exist on disk, reconcile must fail."""
    mod = _load()
    audio_dir = tmp_path / "public" / "audio" / "italian"
    audio_dir.mkdir(parents=True)
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "clips": [
                    {
                        "id": "it-missing-prompt",
                        "text": "X",
                        "language": "it",
                        "voice": "if_sara",
                        "filename": "it-missing-prompt.wav",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    prov_path = tmp_path / "docs" / "audio-provenance" / "missing.json"
    prov_path.parent.mkdir(parents=True)
    prov_path.write_text('{"clips": []}', encoding="utf-8")  # exists, but no WAVs on disk

    monkeypatch.setattr(mod, "AUDIO_DIR", tmp_path / "public" / "audio")
    monkeypatch.setattr(mod, "PROV_DIR", tmp_path / "docs" / "audio-provenance")
    monkeypatch.setattr(
        mod,
        "PROVENANCE_SOURCES",
        [{"path": prov_path, "manifest": manifest, "audio_subdir": "italian"}],
    )

    rc = mod.main()
    captured = capsys.readouterr()
    assert rc == 1
    assert "missing WAV" in captured.err


def test_reconcile_creates_configured_provenance_file(tmp_path, monkeypatch):
    """A newly configured source must not be skipped just because its output is absent."""
    mod = _load()
    audio_dir = tmp_path / "public" / "audio" / "german-foundations"
    audio_dir.mkdir(parents=True)
    (audio_dir / "de-first-words.wav").write_bytes(b"wav-bytes")
    manifest = tmp_path / "services" / "voice" / "scripts" / "german-foundations.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        json.dumps(
            {
                "clips": [
                    {
                        "id": "de-first-words",
                        "text": "Hallo, danke.",
                        "language": "de",
                        "voice": "de_DE-thorsten-medium",
                        "filename": "de-first-words.wav",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    prov_path = tmp_path / "docs" / "audio-provenance" / "german-foundations.json"

    monkeypatch.setattr(mod, "ROOT", tmp_path)
    monkeypatch.setattr(mod, "AUDIO_DIR", tmp_path / "public" / "audio")
    monkeypatch.setattr(
        mod,
        "PROVENANCE_SOURCES",
        [
            {
                "path": prov_path,
                "manifest": manifest,
                "audio_subdir": "german-foundations",
                "model": "piper@1.8.0",
            }
        ],
    )

    assert mod.main() == 0
    written = json.loads(prov_path.read_text(encoding="utf-8"))
    assert written["model"] == "piper@1.8.0"
    assert written["manifest"] == "services/voice/scripts/german-foundations.json"
    assert written["clips"][0]["audio_sha256"] == mod.sha256_bytes(b"wav-bytes")


def test_reconcile_repairs_incomplete_top_level_metadata(tmp_path, monkeypatch):
    """Matching clip hashes must not hide missing canonical source metadata."""
    mod = _load()
    audio_dir = tmp_path / "public" / "audio" / "spanish-foundations"
    audio_dir.mkdir(parents=True)
    wav = b"wav-bytes"
    (audio_dir / "es-first-words.wav").write_bytes(wav)
    manifest = tmp_path / "services" / "voice" / "scripts" / "spanish-foundations.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(
        json.dumps(
            {
                "clips": [
                    {
                        "id": "es-first-words",
                        "text": "Hola, gracias.",
                        "language": "es",
                        "voice": "ef_dora",
                        "filename": "es-first-words.wav",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    prov_path = tmp_path / "docs" / "audio-provenance" / "spanish-foundations.json"
    prov_path.parent.mkdir(parents=True)
    source = {
        "path": prov_path,
        "manifest": manifest,
        "audio_subdir": "spanish-foundations",
    }
    monkeypatch.setattr(mod, "ROOT", tmp_path)
    monkeypatch.setattr(mod, "AUDIO_DIR", tmp_path / "public" / "audio")
    monkeypatch.setattr(mod, "PROVENANCE_SOURCES", [source])
    canonical = mod.build_provenance(source)
    prov_path.write_text(json.dumps({"schema_version": 1, "clips": canonical["clips"]}))

    assert mod.main() == 0
    written = json.loads(prov_path.read_text(encoding="utf-8"))
    assert written["model"] == "kokoro@0.9.4"
    assert written["languages"] == ["es"]
    assert written["voices"] == ["es:ef_dora"]
