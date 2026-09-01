from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar

import pytest


SCRIPT = Path(__file__).parents[1] / "scripts" / "generate_lesson_audio.py"
WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 28


class TtsHandler(BaseHTTPRequestHandler):
    response_status: ClassVar[int] = 200
    response_content_type: ClassVar[str] = "audio/wav"
    response_body: ClassVar[bytes] = WAV

    def do_POST(self) -> None:  # noqa: N802
        self.send_response(self.response_status)
        self.send_header("Content-Type", self.response_content_type)
        self.send_header("Content-Length", str(len(self.response_body)))
        self.end_headers()
        self.wfile.write(self.response_body)

    def log_message(self, format: str, *args: object) -> None:
        pass


@pytest.fixture
def tts_service() -> str:
    TtsHandler.response_status = 200
    TtsHandler.response_content_type = "audio/wav"
    TtsHandler.response_body = WAV
    server = ThreadingHTTPServer(("127.0.0.1", 0), TtsHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def write_manifest(path: Path, clips: list[dict[str, str]]) -> None:
    path.write_text(json.dumps({"clips": clips}), encoding="utf-8")


def valid_clips() -> list[dict[str, str]]:
    return [
        {
            "id": "fr-ordering-politely-prompt",
            "text": "Bonjour, je voudrais un café, s'il vous plaît.",
            "language": "fr",
            "voice": "ff_siwis",
            "filename": "fr-ordering-politely-prompt.wav",
        },
        {
            "id": "fr-ordering-politely-answer",
            "text": "Bien sûr. Vous le prenez sur place ou à emporter ?",
            "language": "fr",
            "voice": "ff_siwis",
            "filename": "fr-ordering-politely-answer.wav",
        },
    ]


def run_exporter(
    manifest: Path, service_url: str, output_dir: Path, provenance: Path
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--manifest",
            str(manifest),
            "--service-url",
            service_url,
            "--output-dir",
            str(output_dir),
            "--provenance",
            str(provenance),
        ],
        check=False,
        text=True,
        capture_output=True,
    )


def test_exports_deterministic_wavs_and_provenance(
    tmp_path: Path, tts_service: str
) -> None:
    # Break caught: authored clips can land outside their stable public filenames or lack reviewable provenance.
    manifest = tmp_path / "pilot.json"
    output_dir = tmp_path / "public" / "audio" / "french-ordering"
    provenance = tmp_path / "provenance.json"
    clips = valid_clips()
    write_manifest(manifest, clips)

    result = run_exporter(manifest, tts_service, output_dir, provenance)

    assert result.returncode == 0, result.stderr
    assert (output_dir / "fr-ordering-politely-prompt.wav").read_bytes() == WAV
    assert (output_dir / "fr-ordering-politely-answer.wav").read_bytes() == WAV
    written = json.loads(provenance.read_text(encoding="utf-8"))
    assert written["schema_version"] == 1
    assert written["clips"] == [
        {
            "id": "fr-ordering-politely-prompt",
            "filename": "fr-ordering-politely-prompt.wav",
            "language": "fr",
            "voice": "ff_siwis",
            "text_sha256": hashlib.sha256(
                clips[0]["text"].encode("utf-8")
            ).hexdigest(),
            "audio_sha256": hashlib.sha256(WAV).hexdigest(),
            "content_type": "audio/wav",
            "bytes": len(WAV),
        },
        {
            "id": "fr-ordering-politely-answer",
            "filename": "fr-ordering-politely-answer.wav",
            "language": "fr",
            "voice": "ff_siwis",
            "text_sha256": hashlib.sha256(
                clips[1]["text"].encode("utf-8")
            ).hexdigest(),
            "audio_sha256": hashlib.sha256(WAV).hexdigest(),
            "content_type": "audio/wav",
            "bytes": len(WAV),
        },
    ]


def test_rejects_manifest_entries_with_missing_or_extra_fields(tmp_path: Path) -> None:
    # Break caught: unchecked authoring manifests can send incomplete or unreviewed fields to TTS.
    manifest = tmp_path / "invalid.json"
    output_dir = tmp_path / "output"
    provenance = tmp_path / "provenance.json"
    clip = valid_clips()[0]
    clip.pop("voice")
    clip["unreviewed"] = "value"
    write_manifest(manifest, [clip])

    result = run_exporter(manifest, "http://127.0.0.1:8000", output_dir, provenance)

    assert result.returncode != 0
    assert "manifest" in result.stderr.lower()
    assert not output_dir.exists()
    assert not provenance.exists()


def test_rejects_non_loopback_service_url(tmp_path: Path) -> None:
    # Break caught: an authoring run can direct lesson text or generated audio to a remote host.
    manifest = tmp_path / "pilot.json"
    output_dir = tmp_path / "output"
    provenance = tmp_path / "provenance.json"
    write_manifest(manifest, valid_clips())

    result = run_exporter(manifest, "https://example.com", output_dir, provenance)

    assert result.returncode != 0
    assert "loopback" in result.stderr.lower()
    assert not output_dir.exists()
    assert not provenance.exists()


@pytest.mark.parametrize(
    ("status", "content_type", "body", "error_fragment"),
    [
        (503, "audio/wav", WAV, "503"),
        (200, "text/plain", b"not a wav", "audio/wav"),
    ],
)
def test_refuses_failed_or_non_wav_tts_responses(
    tmp_path: Path,
    tts_service: str,
    status: int,
    content_type: str,
    body: bytes,
    error_fragment: str,
) -> None:
    # Break caught: failed or non-audio TTS output is committed as a playable lesson clip.
    TtsHandler.response_status = status
    TtsHandler.response_content_type = content_type
    TtsHandler.response_body = body
    manifest = tmp_path / "pilot.json"
    output_dir = tmp_path / "output"
    provenance = tmp_path / "provenance.json"
    write_manifest(manifest, valid_clips())

    result = run_exporter(manifest, tts_service, output_dir, provenance)

    assert result.returncode != 0
    assert error_fragment in result.stderr.lower()
    assert not output_dir.exists()
    assert not provenance.exists()


def test_rejects_manifest_filename_that_escapes_output_directory(tmp_path: Path) -> None:
    # Break caught: a manifest filename traverses out of the reviewed public-audio directory.
    manifest = tmp_path / "unsafe.json"
    output_dir = tmp_path / "output"
    provenance = tmp_path / "provenance.json"
    clips = valid_clips()
    clips[0]["filename"] = "../outside.wav"
    write_manifest(manifest, clips)

    result = run_exporter(manifest, "http://127.0.0.1:8000", output_dir, provenance)

    assert result.returncode != 0
    assert "filename" in result.stderr.lower()
    assert not (tmp_path / "outside.wav").exists()
    assert not provenance.exists()
