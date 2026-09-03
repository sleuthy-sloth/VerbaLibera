# Spanish course audio quality checklist

Generated 2026-09-04. Voice per `docs/local-voice.md`: es=`ef_dora`,
Kokoro 0.9.4. Manifest: `services/voice/scripts/spanish-patterns.json`
(16 clips). Provenance in `docs/audio-provenance/spanish-patterns.json`
(reconciled against disk via
`services/voice/scripts/reconcile_provenance.py`).

## Automated artifact review

- [x] All 16 manifest filenames exist on disk under `public/audio/spanish/`.
- [x] All files are RIFF/WAVE, mono, 16-bit PCM at 24 kHz.
- [x] Manifest text SHA-256 and generated audio SHA-256 values match provenance.
- [x] `services/voice/scripts/reconcile_provenance.py` verifies all 16 clips on disk.
- [x] Machine pre-screen (faster-whisper `small`, CPU): 16/16 clips match
      their manifest text word-for-word (ignoring case/accents/punctuation).

## Listening review

- [x] All 16 files were played through the local Mac audio output.
- [x] A Spanish-speaking operator confirmed that each clip matches its manifest text exactly.
- [x] A Spanish-speaking operator confirmed intelligible pronunciation, natural pacing, and acceptable prosody.
- [x] A Spanish-speaking operator confirmed there are no audible clicks, truncation, unexpected pauses, or artifacts.

Human release gate cleared 2026-09-04: the operator listened to every clip
and approved all of them.
