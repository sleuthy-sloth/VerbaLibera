# FR/IT expansion audio quality checklist

Generated 2026-09-04. Voices per `docs/local-voice.md`: fr=`ff_siwis`,
it=`if_sara`, Kokoro 0.9.4. Manifests:
`services/voice/scripts/french-expansion.json` (6 clips) and
`services/voice/scripts/italian-expansion.json` (6 clips) — the directions,
hotel check-in, and emergency-help patterns. Provenance in
`docs/audio-provenance/french-expansion.json` and
`docs/audio-provenance/italian-expansion.json` (reconciled against disk via
`services/voice/scripts/reconcile_provenance.py`).

## Automated artifact review

- [x] All 12 manifest filenames exist on disk under `public/audio/{french,italian}/`.
- [x] All files are RIFF/WAVE, mono, 16-bit PCM at 24 kHz.
- [x] Manifest text SHA-256 and generated audio SHA-256 values match provenance.
- [x] `services/voice/scripts/reconcile_provenance.py` verifies all 12 clips on disk.
- [x] Machine pre-screen (faster-whisper `small`, CPU): 11/12 clips match
      their manifest text word-for-word. Sole flag `it-hotel-checkin-prompt`
      is STT noise, confirmed by the human listen below.

## Listening review

- [x] All 12 files were played through the local Mac audio output.
- [x] A French/Italian operator confirmed that each clip matches its manifest text exactly.
- [x] A French/Italian operator confirmed intelligible pronunciation, natural pacing, and acceptable prosody.
- [x] A French/Italian operator confirmed there are no audible clicks, truncation, unexpected pauses, or artifacts.

Human release gate cleared 2026-09-04: the operator listened to every clip
and approved all of them.
