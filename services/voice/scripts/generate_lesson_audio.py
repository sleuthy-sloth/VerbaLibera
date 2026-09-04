#!/usr/bin/env python3
"""Export reviewed lesson audio through the local VerbaLibera voice sidecar.

This command is intentionally authoring-only. It does not belong in the browser
or application runtime, and it only contacts a loopback ``/tts`` endpoint.
"""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


CLIP_FIELDS = frozenset({"id", "text", "language", "voice", "filename"})


class ExportError(Exception):
    """A validated authoring failure that should return a nonzero CLI status."""


@dataclass(frozen=True)
class Clip:
    id: str
    text: str
    language: str
    voice: str
    filename: str


class NoRedirect(HTTPRedirectHandler):
    """Prevent a local endpoint from redirecting authored text to another host."""

    def redirect_request(self, *args: Any, **kwargs: Any) -> None:
        return None


def is_loopback_url(value: str) -> str:
    """Return a normalized local HTTP base URL or reject unsafe service URLs."""
    parsed = urlsplit(value)
    if parsed.scheme != "http" or not parsed.hostname:
        raise ExportError("Service URL must be an HTTP loopback URL.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ExportError("Service URL must be a plain loopback URL.")
    if parsed.path not in ("", "/"):
        raise ExportError("Service URL must not include a path.")
    try:
        port = parsed.port
    except ValueError as error:
        raise ExportError("Service URL has an invalid port.") from error
    if port is not None and not 1 <= port <= 65_535:
        raise ExportError("Service URL has an invalid port.")

    hostname = parsed.hostname.lower()
    if hostname != "localhost":
        try:
            if not ipaddress.ip_address(hostname).is_loopback:
                raise ExportError("Service URL host must be loopback-only.")
        except ValueError as error:
            raise ExportError("Service URL host must be loopback-only.") from error

    return urlunsplit(("http", parsed.netloc, "", "", ""))


def load_manifest(path: Path) -> list[Clip]:
    """Load a strictly-shaped, reviewed JSON lesson-audio manifest."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ExportError(f"Invalid manifest: {error}") from error

    if not isinstance(raw, dict) or set(raw) != {"clips"} or not isinstance(raw["clips"], list):
        raise ExportError("Invalid manifest: expected an object with a clips array.")

    clips: list[Clip] = []
    filenames: set[str] = set()
    ids: set[str] = set()
    for index, entry in enumerate(raw["clips"]):
        if not isinstance(entry, dict) or set(entry) != CLIP_FIELDS:
            raise ExportError(
                "Invalid manifest: "
                f"clip {index} must contain exactly {sorted(CLIP_FIELDS)}."
            )
        if any(not isinstance(entry[field], str) or not entry[field].strip() for field in CLIP_FIELDS):
            raise ExportError(f"Invalid manifest: clip {index} fields must be non-empty strings.")
        filename = entry["filename"]
        candidate = Path(filename)
        if (
            candidate.name != filename
            or candidate.suffix != ".wav"
            or filename in {".", ".."}
        ):
            raise ExportError(f"Invalid manifest filename for clip {index}.")
        if filename in filenames or entry["id"] in ids:
            raise ExportError("Invalid manifest: clip ids and filenames must be unique.")
        filenames.add(filename)
        ids.add(entry["id"])
        clips.append(Clip(**entry))

    if not clips:
        raise ExportError("Invalid manifest: clips must not be empty.")
    return clips


def output_paths(output_dir: Path, clips: list[Clip]) -> list[Path]:
    """Derive stable, contained output paths from validated manifest filenames."""
    root = output_dir.resolve()
    paths = [(root / clip.filename).resolve() for clip in clips]
    try:
        for path in paths:
            path.relative_to(root)
    except ValueError as error:
        raise ExportError("Manifest filename escapes the output directory.") from error
    return paths


def fetch_wav(service_url: str, clip: Clip) -> bytes:
    """Synthesize one clip, accepting only successful WAV responses."""
    request = Request(
        f"{service_url}/tts",
        data=json.dumps(
            {"text": clip.text, "language": clip.language, "voice": clip.voice}
        ).encode("utf-8"),
        headers={"Accept": "audio/wav", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=30) as response:
            content_type = response.headers.get_content_type().lower()
            audio = response.read()
    except HTTPError as error:
        raise ExportError(f"TTS request for {clip.id} failed with HTTP {error.code}.") from error
    except URLError as error:
        raise ExportError(f"TTS request for {clip.id} failed: {error.reason}") from error

    if content_type != "audio/wav":
        raise ExportError(f"TTS response for {clip.id} must be audio/wav.")
    if len(audio) < 12 or audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
        raise ExportError(f"TTS response for {clip.id} is not a WAV file.")
    return audio


def write_atomically(path: Path, data: bytes) -> None:
    """Replace a final asset only after its complete content is available."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as file:
            file.write(data)
        os.replace(temporary, path)
    except Exception:
        Path(temporary).unlink(missing_ok=True)
        raise


def provenance_for(clips: list[Clip], audio: list[bytes]) -> dict[str, object]:
    """Produce the reviewable immutable metadata for this export run."""
    return {
        "schema_version": 1,
        "clips": [
            {
                "id": clip.id,
                "filename": clip.filename,
                "language": clip.language,
                "voice": clip.voice,
                "text_sha256": hashlib.sha256(clip.text.encode("utf-8")).hexdigest(),
                "audio_sha256": hashlib.sha256(wav).hexdigest(),
                "content_type": "audio/wav",
                "bytes": len(wav),
            }
            for clip, wav in zip(clips, audio)
        ],
    }


def export(manifest_path: Path, service_url: str, output_dir: Path, provenance_path: Path) -> None:
    """Validate first, then export every manifest clip and its provenance."""
    normalized_service_url = is_loopback_url(service_url)
    clips = load_manifest(manifest_path)
    paths = output_paths(output_dir, clips)
    audio = [fetch_wav(normalized_service_url, clip) for clip in clips]

    for path, wav in zip(paths, audio):
        write_atomically(path, wav)
    provenance = json.dumps(provenance_for(clips, audio), indent=2, ensure_ascii=False)
    write_atomically(provenance_path, f"{provenance}\n".encode("utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate reviewed local lesson WAV assets.")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--service-url", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        export(args.manifest, args.service_url, args.output_dir, args.provenance)
    except ExportError as error:
        print(error, file=os.sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
