import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { migratePackV1ToV2, normalizePack } from "@/features/course-pack/normalize-pack";
import { validateV2Pack } from "@/features/course-pack/schema-v2";
import type { RuntimePack } from "@/features/course-pack/lesson-runtime";

/**
 * Phase 2A step 1: parity for the REAL French pack.
 *
 * `tests/pack-migration-parity.test.ts` proves the transform on a synthetic
 * legacy fixture. French is the pilot because it is the largest v1 pack (222
 * exercises, 24 lessons with prerequisites, 23 retrieval links), so this file
 * proves the same claim against the pack that would actually flip — including
 * the identities stored learner history is keyed by.
 *
 * The assertions below are structural (ids, sets, order) rather than "the
 * runtime objects are deep-equal", because an equality check that passes
 * because both sides were produced by the same code proves less than naming
 * what must not move.
 */

const FRENCH = path.join(process.cwd(), "courses/french/manifest.json");

const frenchSource = (): Record<string, unknown> =>
  JSON.parse(readFileSync(FRENCH, "utf8")) as Record<string, unknown>;

const runtimePacks = (): { v1: RuntimePack; v2: RuntimePack; migrated: unknown } => {
  const source = frenchSource();
  const migrated = migratePackV1ToV2(source);
  return { v1: normalizePack(source), v2: normalizePack(migrated), migrated };
};

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

describe("French v1→v2 migration parity", () => {
  it("still reads the v1 pack this pilot was written against", () => {
    expect(
      frenchSource().schemaVersion,
      "French has been migrated to v2. Update this file: assert the stored pack's own identities instead of migrating it in memory.",
    ).toBe(1);
  });

  it("migrates the real French pack into something the v2 schema accepts", () => {
    const { migrated } = runtimePacks();
    expect(() => validateV2Pack(migrated)).not.toThrow();
  });

  it("is deterministic: the same source migrates to identical bytes", () => {
    const first = JSON.stringify(migratePackV1ToV2(frenchSource()));
    const second = JSON.stringify(migratePackV1ToV2(frenchSource()));
    expect(second).toBe(first);
  });

  it("reaches exactly the same activities before and after", () => {
    const { v1, v2 } = runtimePacks();
    expect(reachableActivityIds(v2)).toEqual(reachableActivityIds(v1));
    // The migrated pack must not quietly drop exercises into legacy limbo.
    expect(reachableActivityIds(v2).length).toBeGreaterThan(200);
  });

  it("keeps every lesson, step and prerequisite identity in order", () => {
    const { v1, v2 } = runtimePacks();
    expect(ids(v2.lessons)).toEqual(ids(v1.lessons));
    expect(v2.lessons.map((lesson) => lesson.unitId)).toEqual(v1.lessons.map((lesson) => lesson.unitId));
    expect(v2.lessons.map((lesson) => lesson.prerequisites.map((p) => p.lessonId))).toEqual(
      v1.lessons.map((lesson) => lesson.prerequisites.map((p) => p.lessonId)),
    );
    expect(stepShape(v2)).toEqual(stepShape(v1));
  });

  it("keeps the exercise identities progress and review are keyed by", () => {
    const { v1, v2 } = runtimePacks();
    const v1Ids = Object.keys(v1.exercisesById).sort();
    const v2Ids = Object.keys(v2.exercisesById).sort();
    expect(v2Ids).toEqual(v1Ids);
    for (const exerciseId of v1Ids) {
      expect(v2.exercisesById[exerciseId]).toEqual(v1.exercisesById[exerciseId]);
      // The review/SRS key is the exercise id and must not be re-derived.
      expect(exerciseId).toBe(v1.exercisesById[exerciseId].id);
    }
    // Retained per lesson, in order, so the completion policy still resolves.
    expect(v2.lessons.map((lesson) => lesson.legacyExercises.map((e) => e.id))).toEqual(
      v1.lessons.map((lesson) => lesson.legacyExercises.map((e) => e.id)),
    );
    expect(v2.lessons.map((lesson) => lesson.legacyCompletionExerciseIds)).toEqual(
      v1.lessons.map((lesson) => lesson.legacyCompletionExerciseIds),
    );
  });

  it("keeps the graph metadata that gating and reporting read", () => {
    const { v1, v2 } = runtimePacks();
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
    const { v1, v2 } = runtimePacks();
    expect(
      v2.media.map((asset) => [asset.id, asset.url, asset.sha256, asset.transcript ?? null]),
    ).toEqual(v1.media.map((asset) => [asset.id, asset.url, asset.sha256, asset.transcript ?? null]));
    expect(v2.media.length).toBeGreaterThan(0);
  });

  it("preserves the retrieval links that make review retrieval, not new material", () => {
    const { v1, v2 } = runtimePacks();
    const retrievalOf = (pack: RuntimePack) =>
      pack.lessons.flatMap((lesson) =>
        lesson.legacyExercises
          .filter((exercise) => exercise.reviewOf.length > 0)
          .map((exercise) => [exercise.id, ...exercise.reviewOf].join(">")),
      );
    expect(retrievalOf(v2)).toEqual(retrievalOf(v1));
    expect(retrievalOf(v2).length).toBeGreaterThan(0);
  });
});
