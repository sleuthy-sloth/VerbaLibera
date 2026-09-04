# VoxLibre — Spanish course + 8-pattern expansion (2026-09-04)

Decided with user over Telegram: third language = **Spanish**, flesh-out = **more patterns per course (5 → 8)**.
New patterns (same scenario set in all 3 languages): directions, hotel check-in, emergency help.

## Steps (TDD each, commit per step)

1. **Sidecar ES support** — `contracts.py`: `es` permitted voices (`VOXLIBRE_VOICE_SPANISH_VOICES`, default `ef_dora`);
   `engines.py`: `_KOKORO_LANGUAGE_CODES["es"]="e"`, `_SUPPORTED_CODES += "es"`, STT pair `("es","en")`.
   Python tests for permits_voice + lang map. Commit `feat:`.
2. **Fixture expansion** — add `directions` / `hotel-checkin` / `emergency-help` patterns to FR + IT;
   new `spanishPatterns` (all 8, mirrored scenarios); `initialCourses` += `makeCourse('spanish','es',…)`.
   `lesson-audio.ts`: `spanishLessonAudio[id]` in `lessonAudioFor` fallthrough. TS tests. Commit.
3. **Audio manifests + WAVs** — `scripts/spanish-patterns.json` (8 clips, `ef_dora`) + 3-clip FR/IT additions
   (extend `french-polish.json` / `italian-patterns.json` or new `expansion.json`); boot sidecar with
   `VOXLIBRE_VOICE_LANGUAGES=fr,it,es` + `VOXLIBRE_VOICE_SPANISH_VOICES=ef_dora`; generate 14 WAVs;
   provenance JSONs; `reconcile_provenance.py` green. Commit.
4. **Verify + docs** — `stt_check.py` on new clips (expect es transcription noise, listen-first flags);
   update `docs/content-authoring.md` + provenance README; full `npm run test`, typecheck, build,
   pytest, `git diff --check`; commit; push.

## Conventions (from voxlibre skill)

- `env -u PYTHONPATH` for all sidecar venv calls. Never `deleteMany` seed; upsert only.
- `lessonAudioFor(id)` fallthrough order: frenchOrderingPilot → french → italian → spanish.
- No `unavailable://` for shipped patterns — every pattern gets a real WAV.
- Scope git adds (macOS ` 2.ts` duplicate hazard); `git show --stat` after commit.
