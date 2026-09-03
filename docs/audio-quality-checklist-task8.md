# Task 8 — French polish + Italian ordering audio quality checklist

Generated 2026-09-03. Voices per `docs/local-voice.md`: fr=`ff_siwis`, it=`if_sara`,
Kokoro 0.9.4. Manifests: `services/voice/scripts/french-polish.json` (8 clips),
`services/voice/scripts/italian-patterns.json` (10 clips, including the
new `it-ordering-politely`). Provenance in `docs/audio-provenance/french-polish.json`
and `docs/audio-provenance/italian-patterns.json` (reconciled against disk via
`services/voice/scripts/reconcile_provenance.py`).

## Automated artifact review

- [x] All 10 new manifest filenames exist on disk under `public/audio/{french,italian}/`.
- [x] All files are RIFF/WAVE, mono, 16-bit PCM at 24 kHz.
- [x] Every sample is finite; no file contains clipped samples.
- [x] French peak levels range from -9.03 to -4.94 dBFS, RMS -23.43 to -22.56 dBFS.
- [x] Italian peak levels range from -3.62 to -1.11 dBFS, RMS -17.45 to -16.49 dBFS.
- [x] Manifest text SHA-256 and generated audio SHA-256 values match provenance.
- [x] The Next.js server returns the asset paths as `audio/wav` with RIFF/WAVE headers.
- [x] `services/voice/scripts/reconcile_provenance.py` verifies all 20 clips on disk.

Per-file measurements for the 10 Task-8 clips:

| file | duration | peak dBFS | RMS dBFS |
| ---- | -------- | --------- | -------- |
| fr-greet-politely-prompt.wav | 3.02s | -5.53 | -22.91 |
| fr-greet-politely-answer.wav | 1.98s | -7.70 | -22.77 |
| fr-find-place-prompt.wav | 1.52s | -9.03 | -23.16 |
| fr-find-place-answer.wav | 2.35s | -6.53 | -22.56 |
| fr-ask-help-prompt.wav | 1.57s | -7.83 | -23.43 |
| fr-ask-help-answer.wav | 2.62s | -6.75 | -22.66 |
| fr-pay-politely-prompt.wav | 1.90s | -4.94 | -22.69 |
| fr-pay-politely-answer.wav | 2.45s | -5.80 | -22.59 |
| it-ordering-politely-prompt.wav | 2.33s | -3.16 | -17.35 |
| it-ordering-politely-answer.wav | 2.12s | -3.21 | -16.85 |

## Listening review

Machine pre-screen (2026-09-03, faster-whisper `small`, CPU): 14/20 clips
match their manifest text word-for-word. Flagged for focused human
listening — note some flags may be STT errors on 2-second clips rather
than TTS errors:

- `fr-ordering-politely-answer` (pilot): "ou à emporter" heard as "ou emporté"
- `it-find-place-prompt`: "Dov'è" heard as "Dove" (elision swallowed)
- `it-greet-politely-answer`: "si accomodi" heard as "sia comodi"
- `it-ordering-politely-answer`: "glielo porto" heard as "il gelo porto"
- `it-pay-politely-answer`: "le porto" heard as "le parto"
- (`fr-find-place-answer` "dix"→"10" is a normalizer artifact, not a real flag.)

Re-run the screen any time with:
`env -u PYTHONPATH services/voice/.venv/bin/python services/voice/scripts/stt_check.py`

- [ ] All 10 files were played once through the local Mac audio output with `afplay`.
- [ ] A French/Italian operator confirmed that each clip matches its manifest text exactly.
- [ ] A French/Italian operator confirmed intelligible pronunciation, natural pacing, and acceptable prosody.
- [ ] A French/Italian operator confirmed there are no audible clicks, truncation, unexpected pauses, or artifacts.

The automated checks are complete. The subjective items remain a human
release gate; do not describe these clips as linguistically reviewed until
the corresponding operator checks them and marks those items complete.
