# Portuguese course audio quality checklist

Generated 2026-09-04. Voice per `docs/local-voice.md`: pt=`pf_dora`,
Kokoro 0.9.4. Manifest: `services/voice/scripts/portuguese-patterns.json`
(16 clips). Provenance in `docs/audio-provenance/portuguese-patterns.json`
(reconciled against disk via
`services/voice/scripts/reconcile_provenance.py`).

## Automated artifact review

- [x] All 16 manifest filenames exist on disk under `public/audio/portuguese/`.
- [x] All files are RIFF/WAVE, mono, 16-bit PCM at 24 kHz.
- [x] Manifest text SHA-256 and generated audio SHA-256 values match provenance.
- [x] `services/voice/scripts/reconcile_provenance.py` verifies all 16 clips on disk.
- [x] Machine pre-screen (faster-whisper `small`, CPU): 13/16 clips match
      their manifest text word-for-word. The 3 flags are STT noise, confirmed
      by the human listen below:
      - `pt-emergency-help-prompt`: exclaimed "Socorro!" heard as "Só corro"
      - `pt-hotel-checkin-prompt`: "tenho uma" heard as "tem uma"
      - `pt-hotel-checkin-answer`: "sua chave" heard as "a sua chave"

## Listening review

- [x] All 16 files were played through the local Mac audio output.
- [x] A Portuguese-speaking operator confirmed that each clip matches its manifest text exactly.
- [x] A Portuguese-speaking operator confirmed intelligible pronunciation, natural pacing, and acceptable prosody.
- [x] A Portuguese-speaking operator confirmed there are no audible clicks, truncation, unexpected pauses, or artifacts.

Human release gate cleared 2026-09-04: the operator listened to every clip
and approved all of them.
