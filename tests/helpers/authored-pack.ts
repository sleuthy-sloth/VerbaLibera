import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { validatePack } from "@/features/course-pack/schema";

/**
 * Put a pack's v1 field names back, whichever schema it now ships.
 *
 * Every shipped pack is schemaVersion 2 (Spanish was the last to flip), and
 * `validatePack(...)` — the v1 validator — rightly refuses all of them. A flipped
 * pack keeps the same authored records, but moves them:
 *
 * - `lessons[].exercises`            → `lessons[].legacyExercises`
 * - `lessons[].optionalExerciseIds`  → `lessons[].legacyCompletionExerciseIds`
 * - `lessons[].prerequisites`        → `{ lessonId, requirement }` objects
 * - `lessons[].explanation`          → the lesson's opening `information` activity `body`
 * - `lessons[].examples`             → the `examples` stimulus that activity points at
 * - the shell's routing field stays at 2, and `activities`/`stimuli` appear
 *
 * The last three are what makes a flipped file look like a *v2* file to a shell:
 * `CourseWorkspace` hands a pack with `activities` to `RuntimeCourseWorkspace`,
 * which then wants a `steps` graph a v1 file never had. Restoring the shape means
 * undoing all of it, and `adaptV1` in `normalize-pack.ts` is the mapping this
 * reads back.
 *
 * That read-back is exact, and `tests/pack-migration-fields.test.ts` proves it by
 * round trip: migrate a v1 pack in memory, restore it with this function, and
 * compare the two field by field. The cast at the end says the same thing in
 * types — the shape is the validated v1 shape by construction, and the content is
 * the same authored records, unmoved.
 *
 * Nine suites read Spanish through `readAuthoredPack`: six that host a real pack
 * on the legacy engine, and the three that assert authored fields.
 * `course-pack.test.ts` used to carry its own copy; it imports this one now.
 */
export const restoreV1Shape = (raw: Record<string, unknown>): ReturnType<typeof validatePack> => {
  const pack = raw as {
    lessons: Array<
      Record<string, unknown> & {
        legacyExercises?: unknown[];
        exercises?: unknown[];
        optionalExerciseIds?: string[];
      }
    >;
    activities?: Array<{ id: string; kind: string; body?: string; stimulusId?: string }>;
    stimuli?: Array<{
      id: string;
      kind: string;
      pairs?: Array<{ target: string; meaning: string }>;
    }>;
  };
  const activities = pack.activities ?? [];
  const stimuli = pack.stimuli ?? [];
  // The two v2-only collections. Dropping them is what keeps a suite on the v1
  // engine rather than being routed to the v2 shell.
  const { activities: _activities, stimuli: _stimuli, ...v1 } = pack;
  return {
    ...v1,
    schemaVersion: 1,
    lessons: pack.lessons.map((lesson) => {
      const intro = activities.find((activity) => activity.id === `${lesson.id}-intro`);
      const examples = stimuli.find((stimulus) => stimulus.id === `${lesson.id}-examples`);
      return {
        ...lesson,
        explanation: intro?.body ?? lesson.explanation ?? "",
        examples: examples?.pairs ?? lesson.examples ?? [],
        exercises: lesson.legacyExercises ?? lesson.exercises ?? [],
        optionalExerciseIds: lesson.optionalExerciseIds ?? [],
        prerequisites: (lesson.prerequisites as unknown[]).map((entry) =>
          typeof entry === "string" ? entry : (entry as { lessonId: string }).lessonId,
        ),
      };
    }),
  } as unknown as ReturnType<typeof validatePack>;
};

/** The same, for a pack on disk, by language. */
export const readAuthoredPack = (language: string): ReturnType<typeof validatePack> =>
  restoreV1Shape(
    JSON.parse(
      readFileSync(join(process.cwd(), "courses", language, "manifest.json"), "utf8"),
    ) as Record<string, unknown>,
  );
