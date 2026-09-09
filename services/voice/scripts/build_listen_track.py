#!/usr/bin/env python3
"""Author static guided lessons locally; audio and transcript share one source.

Requires the voice venv (Kokoro), ffmpeg, and optional piper-tts for German.
Models are loaded only by this CLI, never by the learner application.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import tempfile
import wave

VOICES = {"es": "ef_dora", "pt": "pf_dora", "de": "de_DE-thorsten-medium"}
CODES = {"en": "a", "es": "e", "pt": "p"}


def plan(script):
    if script.get("language") not in VOICES or script.get("voice") != VOICES[script["language"]]:
        raise ValueError("Unsupported language/voice pairing")
    for key in ("lessonId", "courseSlug"):
        if not re.fullmatch(r"[a-z][a-z0-9-]+", script.get(key, "")):
            raise ValueError(f"Invalid {key}")
    if not script.get("lessonTitle") or not script.get("sections"):
        raise ValueError("Title and sections required")
    events = []
    headings = set()
    for section in script["sections"]:
        heading = section.get("heading")
        if not heading or heading in headings or not section.get("teacher", "").strip():
            raise ValueError("Unique heading and narration required")
        headings.add(heading)
        pause = section.get("thinkSeconds", 0)
        if type(pause) not in (int, float) or not 0 <= pause <= 20:
            raise ValueError("Thinking pauses must be between zero and twenty seconds")
        target = section.get("target")
        if pause and not target:
            raise ValueError("A thinking pause must precede a reveal")
        events.append({"kind": "speech", "language": "en", "voice": "af_heart", "text": section["teacher"]})
        if target:
            if not target.get("text", "").strip() or not target.get("meaning", "").strip():
                raise ValueError("Target and translation required")
            events.append({"kind": "silence", "seconds": pause or 1})
            events.append({"kind": "speech", "language": script["language"], "voice": script["voice"], "text": target["text"]})
        events.append({"kind": "silence", "seconds": 1.5})
    return events


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build(source: Path, root: Path, cache: Path, piper_model: Path | None):
    import numpy as np
    import soundfile as sf

    script = json.loads(source.read_text())
    events = plan(script)
    cache.mkdir(parents=True, exist_ok=True)
    pipelines = {}
    piper = None
    engine_versions = {"kokoro": importlib.metadata.version("kokoro")}
    if script["language"] == "de":
        if not piper_model or not piper_model.is_file():
            raise ValueError("German requires --piper-model pointing to de_DE-thorsten-medium.onnx")
        config = json.loads(Path(str(piper_model) + ".json").read_text())
        if config.get("language", {}).get("code") != "de_DE":
            raise ValueError("Expected a German Piper model")
        from piper import PiperVoice
        piper = PiperVoice.load(str(piper_model))
        engine_versions["piper-tts"] = importlib.metadata.version("piper-tts")
        engine_versions["piper_model_sha256"] = digest(piper_model.read_bytes())

    chunks, records = [], []
    for index, event in enumerate(events):
        if event["kind"] == "silence":
            chunks.append(np.zeros(round(event["seconds"] * 24000), dtype=np.float32))
            records.append(event)
            continue
        key = digest(json.dumps([event, engine_versions], sort_keys=True).encode())
        clip = cache / f"{key}.wav"
        if not clip.exists():
            if event["language"] == "de":
                with wave.open(str(clip), "wb") as output:
                    piper.synthesize_wav(event["text"], output)
            else:
                language = event["language"]
                if language not in pipelines:
                    from kokoro import KPipeline
                    pipelines[language] = KPipeline(lang_code=CODES[language], repo_id="hexgrad/Kokoro-82M")
                samples = [audio.numpy() for _, _, audio in pipelines[language](event["text"], voice=event["voice"], speed=0.9)]
                if not samples:
                    raise ValueError("Synthesis produced no audio")
                sf.write(clip, np.concatenate(samples), 24000, subtype="PCM_16")
        samples, rate = sf.read(clip, dtype="float32")
        if samples.ndim != 1 or not len(samples) or not np.isfinite(samples).all() or np.max(np.abs(samples)) < 0.001:
            raise ValueError(f"Invalid or silent synthesized audio: {clip}")
        if rate != 24000:
            raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(clip),
                                           "-ar", "24000", "-ac", "1", "-f", "f32le", "pipe:1"])
            samples = np.frombuffer(raw, dtype="<f4")
        records.append({**event, "text_sha256": digest(event["text"].encode()),
                        "audio_sha256": digest(clip.read_bytes()), "cacheFile": clip.name,
                        "durationS": round(len(samples) / 24000, 3)})
        chunks.append(samples)
        print(f"{source.stem}: {index + 1}/{len(events)} {event['language']}", flush=True)

    audio_url = f"/audio/{script['courseSlug']}-foundations/{script['lessonId']}-listen.mp3"
    destination = root / "public" / audio_url.lstrip("/")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        wav = Path(temporary) / "track.wav"
        mp3 = Path(temporary) / "track.mp3"
        sf.write(wav, np.concatenate(chunks), 24000, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ar", "24000", "-ac", "1", "-b:a", "64k", str(mp3)], check=True)
        destination.write_bytes(mp3.read_bytes())
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(destination)]))
    metadata = {key: script[key] for key in ("lessonId", "courseSlug", "lessonTitle", "sections")}
    metadata.update(audioUrl=audio_url, durationS=round(duration, 2), reviewPending=True)
    generated = root / "src/features/listen/generated" / f"{script['courseSlug']}.json"
    generated.parent.mkdir(parents=True, exist_ok=True)
    generated.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    provenance = {"source": str(source.relative_to(root)), "source_sha256": digest(source.read_bytes()),
                  "audioUrl": audio_url, "audio_sha256": digest(destination.read_bytes()),
                  "durationS": round(duration, 2), "engines": engine_versions,
                  "review": "Machine-authored. Waveform and assembly checked; native-speaker editorial and prosody review open.",
                  "events": records}
    (root / "docs/audio-provenance" / f"{script['courseSlug']}-introductions-listen.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n")
    print(f"Built {audio_url}: {duration:.2f}s", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--piper-model", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    build(args.source.resolve(), root, args.cache, args.piper_model)
