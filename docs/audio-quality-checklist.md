# French ordering pilot audio quality checklist

Generated on 2026-09-01 from the reviewed manifest with Kokoro 0.9.4 and the
French `ff_siwis` voice. The generation sidecar was bound only to
`127.0.0.1:8090` and was stopped after export.

## Automated artifact review

- [x] Both manifest filenames exist under `public/audio/french-ordering/`.
- [x] Both files are RIFF/WAVE, mono, 16-bit PCM at 24 kHz.
- [x] Prompt duration is 3.00 seconds; answer duration is 3.35 seconds.
- [x] Manifest text SHA-256 and generated audio SHA-256 values match provenance.
- [x] Every sample is finite; neither file contains clipped samples.
- [x] Prompt peak/RMS levels are -5.88/-23.00 dBFS.
- [x] Answer peak/RMS levels are -5.33/-22.53 dBFS.
- [x] Both files retain roughly 0.4 seconds of head and tail room below -45 dBFS.
- [x] The Next.js server returns both asset paths as `audio/wav` with RIFF/WAVE headers.
- [x] The French lesson exposes its audio control while reveal and self-check remain usable.
- [x] The sidecar endpoint is not referenced by browser code.

## Listening review

- [x] Both files were played once through the local Mac audio output with `afplay`.
- [x] A French-speaking operator confirmed that each clip matches its manifest text exactly.
- [x] A French-speaking operator confirmed intelligible pronunciation, natural pacing, and acceptable prosody.
- [x] A French-speaking operator confirmed there are no audible clicks, truncation, unexpected pauses, or artifacts.

Human release gate cleared 2026-09-04: the operator listened to both clips
and approved them.
