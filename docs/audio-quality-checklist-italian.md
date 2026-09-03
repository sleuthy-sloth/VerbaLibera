# Italian patterns audio quality checklist (Task 7)

Generated on 2026-09-03 from the reviewed manifest
`services/voice/scripts/italian-patterns.json` with Kokoro 0.9.4 and the
Italian `if_sara` voice. The generation sidecar was bound only to
`127.0.0.1:8090` and was stopped after export. Provenance (text/audio SHA-256)
is in `docs/audio-provenance/italian-patterns.json`.

Covers the four Italian patterns beyond ordering (prompt + answer each):
`it-greet-politely`, `it-find-place`, `it-ask-help`, `it-pay-politely`.
`it-ordering-politely` remains `unavailable://` until Task 8.

## Automated artifact review

- [x] All 8 manifest filenames exist under `public/audio/italian/`.
- [x] All files are RIFF/WAVE, mono, 16-bit PCM at 24 kHz.
- [x] Every sample is finite; no file contains clipped samples.
- [x] Peak levels range from -3.62 to -1.11 dBFS; RMS levels from -17.45 to -16.49 dBFS.
- [x] Durations: prompts 1.75–3.12s, answers 2.40–2.80s.
- [x] Every file retains head room (~0.22–0.25s) and tail room (~0.40–0.50s) below -45 dBFS.
- [x] Manifest text SHA-256 and generated audio SHA-256 values match provenance.
- [x] The Next.js server returns the asset paths as `audio/wav` with RIFF/WAVE headers.
- [x] The Italian lessons expose their audio controls while reveal and self-check remain usable.
- [x] The sidecar endpoint is not referenced by browser code.

Per-file measurements:

| file | duration | peak dBFS | RMS dBFS |
| ---- | -------- | --------- | -------- |
| it-greet-politely-prompt.wav | 3.12s | -3.62 | -17.45 |
| it-greet-politely-answer.wav | 2.52s | -3.48 | -16.91 |
| it-find-place-prompt.wav | 1.95s | -2.00 | -16.76 |
| it-find-place-answer.wav | 2.80s | -1.11 | -17.20 |
| it-ask-help-prompt.wav | 1.75s | -2.74 | -16.49 |
| it-ask-help-answer.wav | 2.45s | -3.37 | -17.25 |
| it-pay-politely-prompt.wav | 2.12s | -2.11 | -16.91 |
| it-pay-politely-answer.wav | 2.40s | -2.14 | -17.02 |

## Listening review

- [x] All 8 files were played once through the local Mac audio output with `afplay`.
- [x] An Italian-speaking operator confirmed that each clip matches its manifest text exactly.
- [x] An Italian-speaking operator confirmed intelligible pronunciation, natural pacing, and acceptable prosody.
- [x] An Italian-speaking operator confirmed there are no audible clicks, truncation, unexpected pauses, or artifacts.

Human release gate cleared 2026-09-04: the operator listened to every clip
and approved all of them.
