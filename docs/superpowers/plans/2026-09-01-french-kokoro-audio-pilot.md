# French Kokoro Audio Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and play reviewed, original Kokoro audio for the French polite-ordering pattern while preserving a usable no-audio fallback.

**Architecture:** A small authoring-only Python command calls the existing loopback `/tts` service for an explicit manifest of French segments, validates WAV responses, writes deterministic public assets, and records provenance. The curriculum fixture points only the pilot pattern at those committed assets; the guided session passes real segments to the existing `AudioPlayer` when every segment is available, otherwise it retains the authored-text path.

**Tech Stack:** Python 3.10+, FastAPI/Kokoro sidecar, Next.js 16, React 19, TypeScript, Vitest, Playwright.

**Spec:** Conversation-approved French voice-quality pilot, 2026-09-01.

## Global Constraints

- Use the existing local loopback-only Kokoro sidecar and French `ff_siwis` voice; never expose the authoring endpoint to browsers.
- Generate only the original French polite-ordering prompt and model-answer clips in this pilot; do not download/store learner recordings or transcripts.
- Commit reviewed WAV assets and provenance metadata; preserve text-only fallback if any asset is missing or unavailable.
- No persistence, mastery, XP, SRS, or pronunciation claims.
- Tests precede production code and prove fallback, asset mapping, and authoring validation behavior.

---

### Task 1: Add a deterministic, authoring-only Kokoro exporter

**Files:**
- Create: `services/voice/scripts/generate_lesson_audio.py`
- Create: `services/voice/scripts/french-ordering-pilot.json`
- Create: `services/voice/tests/test_generate_lesson_audio.py`
- Create: `public/audio/french-ordering/.gitkeep`
- Create: `docs/audio-provenance/french-ordering-pilot.json`

**Interfaces:**
- `generate_lesson_audio.py --manifest <path> --service-url <loopback-url> --output-dir <path> --provenance <path>` returns nonzero for invalid manifests, non-WAV responses, or unsafe/non-loopback URLs.
- Manifest contains exactly `id`, `text`, `language`, `voice`, and output filename for `fr-ordering-politely-prompt` and `fr-ordering-politely-answer`.

- [ ] Write pytest cases for manifest validation, deterministic output paths, rejected non-WAV/HTTP failure, and provenance fields; run them RED.
- [ ] Implement the smallest standard-library HTTP exporter and JSON provenance writer; run pytest GREEN.
- [ ] Commit the exporter, manifest, tests, empty asset directory, and provenance schema/placeholder.

### Task 2: Wire real pilot audio into the French lesson path

**Files:**
- Modify: `src/features/curriculum/fixture.ts`
- Modify: `src/components/session/GuidedSession.tsx`
- Modify: `src/components/session/session.module.css`
- Modify: `tests/curriculum-fixture.test.ts`
- Modify: `tests/GuidedSession.test.tsx`

**Interfaces:**
- The French ordering concept’s two authored segments point to `/audio/french-ordering/<filename>.wav` only after generated files exist; all other patterns remain `unavailable://`.
- `GuidedSession` renders `AudioPlayer` for a fully playable active pattern and retains the current honest text-only fallback for unavailable segments.

- [ ] Add focused failing Vitest tests for French pilot asset URLs and `AudioPlayer` rendering, plus unavailable Italian/text fallback.
- [ ] Implement the smallest segment conversion/rendering change; ensure reveal/self-check is still available independently of audio playback; run focused tests GREEN.
- [ ] Commit the integration.

### Task 3: Generate, inspect, and verify the reviewed pilot assets

**Files:**
- Create: `public/audio/french-ordering/fr-ordering-politely-prompt.wav`
- Create: `public/audio/french-ordering/fr-ordering-politely-answer.wav`
- Modify: `docs/audio-provenance/french-ordering-pilot.json`
- Create: `docs/audio-quality-checklist.md`
- Modify: `tests/e2e/guided-session.spec.ts`

**Interfaces:**
- Generated WAVs are 24 kHz, nonempty, and map exactly to the manifest/provenance records.
- Browser test sees the lesson audio player and retains the existing reveal/self-check path.

- [ ] Install/start the approved local dependencies and sidecar only with explicit operator environment configuration; run `/health` first.
- [ ] Generate the two WAVs, inspect their file format/duration, update immutable provenance with Kokoro version, voice, source text hash, generation date, and tool command; listen to both clips manually against the checklist.
- [ ] Add a browser test proving the audio control is present for French and fallback remains reachable; run the focused E2E test GREEN.
- [ ] Run Python exporter tests, focused Vitest/E2E, then lint/typecheck/build; commit generated reviewed assets and evidence.
