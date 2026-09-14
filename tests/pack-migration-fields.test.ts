// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { migratePackV1ToV2, normalizePack } from "@/features/course-pack/normalize-pack";
import { validateV2Pack } from "@/features/course-pack/schema-v2";
import { makeLegacyRawPack } from "./fixtures/lesson-variety";
import { readAuthoredPack, restoreV1Shape } from "./helpers/authored-pack";

/**
 * A field census for the v1→v2 migration.
 *
 * Two silent losses have now shipped through this migration: the authored CEFR
 * tag (25 French lessons, invisible until a report showed `authoredCefrTags` at
 * zero) and `culturalNote` (8 lessons per course, which nothing renders, so
 * nothing would ever have noticed). Both were found by hand, one flip at a
 * time. This test is the general form: every field a v1 lesson carries must
 * either appear in the migrated output or be on the documented relocate list
 * below, with the route it travels named.
 *
 * It runs against a v1 pack, so it needs one to exist, and no shipped pack is v1
 * any more — Spanish was the last. So it reads the fixture instead of being
 * deleted, which is what this note said to do: `tests/fixtures/lesson-variety.ts`
 * is a real three-lesson A1 Spanish starter, and it carries every v1 lesson field
 * the census below rules on.
 */

const FIXTURE = "fixture";
const V1_PACKS = [FIXTURE] as const;
/**
 * Flipped already, and read from the tree rather than migrated in memory.
 *
 * French and Italian were flipped before `cefr` and `culturalNote` had a home in
 * the v2 lesson, so their authored tags and notes are the recorded, unfixed loss
 * (French authored one cultural note; it is not in the file). German was flipped
 * with both fields in place, which is what `expected` pins. Restoring French and
 * Italian is a data change: it is the user's call, not something to do quietly.
 */
const FLIPPED_PACKS = [
  { language: "german", lessons: 10, notes: 10, tags: 10 },
  { language: "portuguese", lessons: 8, notes: 8, tags: 8 },
  { language: "spanish", lessons: 8, notes: 8, tags: 8 },
  { language: "french", lessons: 26, notes: 0, tags: 0 },
] as const;

const readRaw = (language: string): Record<string, unknown> =>
  language === FIXTURE
    ? makeLegacyRawPack()
    : (JSON.parse(
        readFileSync(join(process.cwd(), "courses", language, "manifest.json"), "utf8"),
      ) as Record<string, unknown>);

/**
 * v1 lesson fields that do not appear on the migrated lesson object, and where
 * they went instead. A field that is dropped with no entry here fails the test;
 * an entry here is a claim that can be checked by eye and by the assertions
 * below.
 */
const RELOCATED: Record<string, string> = {
  explanation: "the lesson's opening `information` activity `body` (adaptV1)",
  examples: "the lesson's `examples` stimulus `pairs` (adaptV1)",
  exercises: "`legacyExercises` on the migrated lesson",
  optionalExerciseIds: "`legacyCompletionExerciseIds` on the migrated lesson",
};

/** Fields the migrated lesson is expected to carry itself. */
const CARRIED = ["id", "unitId", "title", "objective", "cefr", "culturalNote", "conceptIds", "vocabulary"] as const;

describe("what the v1→v2 migration does with every authored lesson field", () => {
  it.each(V1_PACKS)("%s: no authored lesson field disappears without a stated route", (language) => {
    const raw = readRaw(language);
    const v1Lesson = (raw.lessons as Array<Record<string, unknown>>)[0];
    const migrated = migratePackV1ToV2(raw) as { lessons: Array<Record<string, unknown>> };
    const v2Lesson = migrated.lessons[0];

    const unexplained = Object.keys(v1Lesson).filter(
      (key) => !(key in v2Lesson) && !(key in RELOCATED),
    );
    expect(unexplained, `unexplained v1 lesson fields for ${language}`).toEqual([]);
  });

  it.each(V1_PACKS)("%s: the fields that should be carried are carried", (language) => {
    const raw = readRaw(language);
    const migrated = migratePackV1ToV2(raw) as { lessons: Array<Record<string, unknown>> };
    const v1Lessons = raw.lessons as Array<Record<string, unknown>>;

    for (const v1Lesson of v1Lessons) {
      const v2Lesson = migrated.lessons.find((lesson) => lesson.id === v1Lesson.id);
      expect(v2Lesson, `${v1Lesson.id} survived`).toBeDefined();
      expect(v2Lesson!.title).toBe(v1Lesson.title);
      expect(v2Lesson!.objective).toBe(v1Lesson.objective);
      expect(v2Lesson!.cefr).toBe(v1Lesson.cefr);
      // The one nothing renders, and the one that used to vanish.
      expect(v2Lesson!.culturalNote).toBe(v1Lesson.culturalNote);
    }
    expect(() => validateV2Pack(migrated)).not.toThrow();
  });

  it.each(V1_PACKS)("%s: the relocated fields really are where the census says", (language) => {
    const raw = readRaw(language);
    const migrated = migratePackV1ToV2(raw) as {
      activities: Array<{ id: string; kind: string; body?: string }>;
      stimuli: Array<{ id: string; kind: string; pairs?: unknown[] }>;
      lessons: Array<Record<string, unknown>>;
    };
    const v1Lessons = raw.lessons as Array<Record<string, unknown>>;

    for (const v1Lesson of v1Lessons) {
      const id = v1Lesson.id as string;
      const info = migrated.activities.find((activity) => activity.id === `${id}-intro`);
      expect(info, `${id}: information activity`).toBeDefined();
      expect(info!.kind).toBe("information");
      // The explanation is the whole point of that activity.
      expect(info!.body).toBe(v1Lesson.explanation);

      const examples = migrated.stimuli.find((stimulus) => stimulus.id === `${id}-examples`);
      expect(examples, `${id}: examples stimulus`).toBeDefined();
      expect(examples!.pairs).toEqual(v1Lesson.examples);

      const v2Lesson = migrated.lessons.find((lesson) => lesson.id === id)!;
      expect((v2Lesson.legacyExercises as unknown[]).length).toBe(
        (v1Lesson.exercises as unknown[]).length,
      );
    }
  });

  it.each(FLIPPED_PACKS)(
    "$language: the flipped file still carries the fields the schema has a home for",
    ({ language, lessons: expectedLessons, notes, tags }) => {
      // The migration is not re-run for these: the point is what the stored
      // artifact holds. A re-migration that dropped culturalNote or cefr would
      // pass every other test in the tree and fail this one.
      const raw = readRaw(language);
      const lessons = raw.lessons as Array<Record<string, unknown>>;
      expect(lessons).toHaveLength(expectedLessons);
      const withNote = lessons.filter(
        (lesson) => typeof lesson.culturalNote === "string" && lesson.culturalNote.length > 0,
      );
      const withTag = lessons.filter((lesson) => typeof lesson.cefr === "string");
      expect(withNote.length, `${language} lessons carrying a cultural note`).toBe(notes);
      expect(withTag.length, `${language} lessons carrying a CEFR tag`).toBe(tags);
    },
  );

  it("the census can fail: a field with no route is caught", () => {
    // Non-vacuity. Take a real v1 pack, add a field the migration has never
    // heard of, and confirm the check flags it rather than passing quietly.
    const raw = readRaw(FIXTURE);
    const lessons = raw.lessons as Array<Record<string, unknown>>;
    const doctored = {
      ...raw,
      lessons: lessons.map((lesson) => ({ ...lesson, audioNote: "a field v2 has no home for" })),
    };
    const migrated = migratePackV1ToV2(doctored) as { lessons: Array<Record<string, unknown>> };
    const unexplained = Object.keys((doctored.lessons as Array<Record<string, unknown>>)[0]).filter(
      (key) => !(key in migrated.lessons[0]) && !(key in RELOCATED),
    );
    expect(unexplained).toEqual(["audioNote"]);
  });

  it("reads a migrated lesson back into the shape it was authored in", () => {
    // The suites that host on the v1 engine read a flipped file through
    // `readAuthoredPack`, which claims the read-back is exact. Here it is, field by
    // field: migrate the authored pack in memory, restore it, and compare with the
    // source it came from — the two relocated fields included.
    const source = readRaw(FIXTURE);
    const restored = restoreV1Shape(
      migratePackV1ToV2(source) as Record<string, unknown>,
    ) as unknown as {
      schemaVersion: number;
      lessons: Array<Record<string, unknown> & { exercises: unknown[] }>;
    };
    const authored = source.lessons as Array<Record<string, unknown> & { exercises: unknown[] }>;
    expect(restored.schemaVersion).toBe(1);
    expect(restored.lessons).toHaveLength(authored.length);
    for (const [index, lesson] of restored.lessons.entries()) {
      const original = authored[index];
      for (const field of ["id", "title", "objective", "cefr", "culturalNote", "unitId"]) {
        expect(lesson[field], `${lesson.id as string}.${field}`).toEqual(original[field]);
      }
      expect(lesson.explanation).toEqual(original.explanation);
      expect(lesson.examples).toEqual(original.examples);
      expect(lesson.exercises).toEqual(original.exercises);
      expect(lesson.prerequisites).toEqual(original.prerequisites);
      expect(lesson.optionalExerciseIds).toEqual(original.optionalExerciseIds);
    }
    // And the same read on the shipped pack fills those fields rather than
    // returning empty ones, so the claim is not only true of the fixture.
    const spanish = readAuthoredPack("spanish");
    expect(spanish.lessons.every((lesson) => lesson.explanation.length > 0)).toBe(true);
    expect(spanish.lessons.every((lesson) => lesson.examples.length >= 2)).toBe(true);
    expect(spanish.lessons.some((lesson) => lesson.exercises.length > 0)).toBe(true);
  });

  it("states the route for every relocated field, so the list cannot rot", () => {
    for (const [field, route] of Object.entries(RELOCATED)) {
      expect(route.length, `${field} has a stated route`).toBeGreaterThan(10);
    }
    // And the carried list matches what the schema claims.
    const migrated = migratePackV1ToV2(readRaw(FIXTURE)) as { lessons: Array<Record<string, unknown>> };
    for (const field of CARRIED) {
      expect(field in migrated.lessons[0], `${field} present on the migrated lesson`).toBe(true);
    }
    // The runtime is a different shape and must not have grown these fields.
    const runtime = normalizePack(migrated) as unknown as { lessons: Array<Record<string, unknown>> };
    expect("culturalNote" in runtime.lessons[0]).toBe(false);
  });
});
