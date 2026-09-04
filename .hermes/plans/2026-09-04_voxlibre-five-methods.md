# VoxLibre — five learning methods (2026-09-04)

1. **Listen-and-type** (`LISTEN_TYPE`): play answer clip, type what you hear.
   Grades via existing `/api/answer-check` text match. Fixture: 1 per concept.
2. **Sentence builder** (`WORD_ORDER`): tap tokens in order. Deterministic
   seeded shuffle at render (no new columns). Fixture: 1 per concept.
3. **Real review queue**: `buildReviewSession` — signed-in snapshot prefers
   SRS-due items via `scheduleReview`; demo keeps fiction. Mocked-Prisma tests.
4. **Streaks**: pure `computeStreak(dates, today)` + dashboard display.
5. **Record-and-compare**: in-memory mic capture + side-by-side playback
   with model clip on NEW_PATTERN steps. No upload, discarded on advance.

Demo path grows to 8 steps ("8-minute session"): review + text×2 +
picture×2 + listen×1 (ordering) + builder×1 (ordering) + new pattern.
Only ONE Prisma migration (enum +. no columns): `20260904000001_add_listen_wordorder_kinds`.
Seed: 64 → 128 drills (32 listen + 32 builder), upsert calls ×2 similarly.
