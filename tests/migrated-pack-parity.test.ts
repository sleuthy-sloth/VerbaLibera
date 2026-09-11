import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { migratePackV1ToV2, normalizePack } from "@/features/course-pack/normalize-pack";
import { validateV2Pack } from "@/features/course-pack/schema-v2";
import type { RuntimePack } from "@/features/course-pack/lesson-runtime";

/**
 * Phase 2A evidence, in two halves.
 *
 * **The packs still at v1.** `tests/pack-migration-parity.test.ts` proves the
 * transform on a synthetic legacy fixture. These assertions make the same claim
 * against every REAL v1 pack that is still waiting its turn — German,
 * Portuguese and Spanish — so the next migration in the queue has the evidence
 * already in place and a regression in the adapter shows up before it touches
 * content.
 *
 * **The pack that has migrated.** French IS schemaVersion 2 as of this commit.
 * The migration is not re-run here; what is pinned is that the stored artifact
 * kept every identity learner history and review are keyed by, and that the
 * file is no longer migratable (re-running the script would be a silent no-op
 * otherwise). The history-replay half of the evidence lives in
 * `tests/migrated-pack-replay.test.tsx`.
 */

const PENDING_PACKS = ["portuguese", "spanish"] as const;

const readPack = (language: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), "courses", language, "manifest.json"), "utf8"),
  ) as Record<string, unknown>;

const ids = (values: readonly { id: string }[]): string[] => values.map((value) => value.id);

const stepShape = (pack: RuntimePack) =>
  pack.lessons.map((lesson) => ({
    lessonId: lesson.id,
    steps: lesson.steps.map((step) => ({
      id: step.id,
      activityId: step.activityId,
      required: step.required,
      nextStepId: step.nextStepId,
    })),
  }));

const reachableActivityIds = (pack: RuntimePack): string[] =>
  [
    ...new Set(
      pack.lessons.flatMap((lesson) => [
        ...lesson.steps.map((step) => step.activityId),
        ...lesson.steps.flatMap((step) => (step.supportActivityId ? [step.supportActivityId] : [])),
      ]),
    ),
  ].sort();

const retrievalLinks = (pack: RuntimePack): string[] =>
  pack.lessons.flatMap((lesson) =>
    lesson.legacyExercises
      .filter((exercise) => exercise.reviewOf.length > 0)
      .map((exercise) => [exercise.id, ...exercise.reviewOf].join(">")),
  );

/**
 * The packs that have migrated.
 *
 * French went first, German second. The migration is not re-run for either —
 * what is pinned is that the stored artifact kept every identity learner history
 * and review are keyed by, and that the file refuses to migrate again (re-running
 * the script would otherwise be a silent no-op). The history-replay half of the
 * evidence lives in `tests/migrated-pack-replay.test.tsx` and
 * `tests/german-migration-replay.test.tsx`.
 */
const MIGRATED_PACKS = [
  {
    language: "french",
    lessons: 25,
    units: 6,
    concepts: 25,
    vocabulary: 102,
    media: 26,
    withPrerequisites: 24,
    retainedExercises: 200, // lower bound: asserted as "more than"
    reachable: 247,
    retrieval: 23,
  },
  {
    language: "german",
    lessons: 8,
    units: 4,
    concepts: 8,
    vocabulary: 34,
    media: 1,
    withPrerequisites: 7,
    retainedExercises: 40, // lower bound
    reachable: 56,
    retrieval: 39,
  },
] as const;

describe.each(PENDING_PACKS)("%s v1→v2 migration parity (real content)", (language) => {
  const source = () => readPack(language);
  const runtime = () => {
    const raw = source();
    return { v1: normalizePack(raw), v2: normalizePack(migratePackV1ToV2(raw)) };
  };

  it("is still a v1 pack, so this parity holds", () => {
    expect(source().schemaVersion).toBe(1);
  });

  it("migrates into a pack the v2 schema accepts", () => {
    expect(() => validateV2Pack(migratePackV1ToV2(source()))).not.toThrow();
  });

  it("is deterministic: the same source migrates to identical bytes", () => {
    expect(JSON.stringify(migratePackV1ToV2(source()))).toBe(
      JSON.stringify(migratePackV1ToV2(source())),
    );
  });

  it("reaches exactly the same activities before and after", () => {
    const { v1, v2 } = runtime();
    expect(reachableActivityIds(v2)).toEqual(reachableActivityIds(v1));
    expect(reachableActivityIds(v2).length).toBeGreaterThan(0);
  });

  it("keeps every lesson, step and prerequisite identity in order", () => {
    const { v1, v2 } = runtime();
    expect(ids(v2.lessons)).toEqual(ids(v1.lessons));
    expect(v2.lessons.map((lesson) => lesson.unitId)).toEqual(
      v1.lessons.map((lesson) => lesson.unitId),
    );
    expect(v2.lessons.map((lesson) => lesson.prerequisites.map((p) => p.lessonId))).toEqual(
      v1.lessons.map((lesson) => lesson.prerequisites.map((p) => p.lessonId)),
    );
    expect(stepShape(v2)).toEqual(stepShape(v1));
  });

  it("keeps the exercise identities progress and review are keyed by", () => {
    const { v1, v2 } = runtime();
    const v1Ids = Object.keys(v1.exercisesById).sort();
    expect(Object.keys(v2.exercisesById).sort()).toEqual(v1Ids);
    for (const exerciseId of v1Ids) {
      expect(v2.exercisesById[exerciseId]).toEqual(v1.exercisesById[exerciseId]);
      expect(exerciseId).toBe(v1.exercisesById[exerciseId].id);
    }
    expect(v2.lessons.map((lesson) => lesson.legacyExercises.map((e) => e.id))).toEqual(
      v1.lessons.map((lesson) => lesson.legacyExercises.map((e) => e.id)),
    );
    expect(v2.lessons.map((lesson) => lesson.legacyCompletionExerciseIds)).toEqual(
      v1.lessons.map((lesson) => lesson.legacyCompletionExerciseIds),
    );
  });

  it("keeps the graph metadata that gating and reporting read", () => {
    const { v1, v2 } = runtime();
    expect(ids(v2.units)).toEqual(ids(v1.units));
    expect(ids(v2.concepts)).toEqual(ids(v1.concepts));
    expect(ids(v2.vocabulary)).toEqual(ids(v1.vocabulary));
    expect(v2.lessons.map((lesson) => lesson.conceptIds)).toEqual(
      v1.lessons.map((lesson) => lesson.conceptIds),
    );
    expect(v2.lessons.map((lesson) => lesson.vocabulary)).toEqual(
      v1.lessons.map((lesson) => lesson.vocabulary),
    );
  });

  it("keeps every media reference and hash", () => {
    const { v1, v2 } = runtime();
    expect(
      v2.media.map((asset) => [asset.id, asset.url, asset.sha256, asset.transcript ?? null]),
    ).toEqual(v1.media.map((asset) => [asset.id, asset.url, asset.sha256, asset.transcript ?? null]));
    expect(v2.media.length).toBeGreaterThan(0);
  });

  it("preserves the retrieval links that make review retrieval, not new material", () => {
    const { v1, v2 } = runtime();
    expect(retrievalLinks(v2)).toEqual(retrievalLinks(v1));
    expect(retrievalLinks(v2).length).toBeGreaterThan(0);
  });
});

describe.each(MIGRATED_PACKS)(
  "$language is a migrated pack",
  ({ language, ...expected }) => {
    const stored = () => {
      const raw = readPack(language);
      return { raw, pack: normalizePack(raw) };
    };

    it("is schemaVersion 2, and refuses to be migrated a second time", () => {
      const { raw } = stored();
      expect(raw.schemaVersion).toBe(2);
      // The migration script exits loudly on a v2 pack; this is the same guard
      // from the test side, so a half-applied flip cannot look clean.
      expect(() => migratePackV1ToV2(raw)).toThrow(/schemaVersion 1/);
      expect(() => validateV2Pack(raw)).not.toThrow();
    });

    it("keeps one activity per retained exercise, under the same id", () => {
      // This is what makes stored practice replay: the old player wrote events
      // keyed by exercise id, and the v2 player grades the activity with that
      // same id.
      const { pack } = stored();
      const retained = pack.lessons.flatMap((lesson) => lesson.legacyExercises.map((e) => e.id));
      expect(retained.length).toBeGreaterThan(expected.retainedExercises);
      for (const exerciseId of retained) {
        expect(pack.activities[exerciseId], `${exerciseId} has no activity`).toBeDefined();
        expect(pack.exercisesById[exerciseId], `${exerciseId} has no retained record`).toBeDefined();
        expect(pack.activities[exerciseId].id).toBe(exerciseId);
      }
      expect(Object.keys(pack.exercisesById).sort()).toEqual([...retained].sort());
    });

    it("lets every reachable activity carry the exercise identity review is keyed by", () => {
      const { pack } = stored();
      for (const lesson of pack.lessons)
        for (const step of lesson.steps) {
          const activity = pack.activities[step.activityId];
          expect(activity, `${step.activityId} missing`).toBeDefined();
          if (activity.kind === "information" || activity.kind === "self-compare") continue;
          expect(activity.evidenceKey).toBe(activity.id);
          expect(pack.exercisesById[activity.evidenceKey]).toBeDefined();
        }
    });

    it("keeps every lesson, prerequisite chain and media hash it had as v1", () => {
      const { pack } = stored();
      expect(pack.lessons).toHaveLength(expected.lessons);
      expect(pack.units).toHaveLength(expected.units);
      expect(pack.concepts).toHaveLength(expected.concepts);
      expect(pack.vocabulary).toHaveLength(expected.vocabulary);
      expect(pack.media).toHaveLength(expected.media);
      expect(pack.lessons.filter((lesson) => lesson.prerequisites.length > 0)).toHaveLength(
        expected.withPrerequisites,
      );
      // The reachable set is the exercises plus one notice step per lesson.
      expect(reachableActivityIds(pack)).toHaveLength(expected.reachable);
      expect(retrievalLinks(pack)).toHaveLength(expected.retrieval);
      for (const asset of pack.media) expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    });
  },
);
