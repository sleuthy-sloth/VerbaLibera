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
