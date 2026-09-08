import { describe, it, expect } from "vitest";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import {
  makePilotPack,
  makeLegacyRawPack,
} from "./fixtures/lesson-variety";

describe("lesson normalize", () => {
  it("keeps v1 exercise identities for progress replay", () => {
    const raw = makeLegacyRawPack();
    const pack = normalizePack(raw);
    expect(pack.schemaVersion).toBe(1);
    expect(Object.keys(pack.exercisesById).sort()).toEqual(
      ((raw.lessons as Array<{ exercises: Array<{ id: string }> }>)[0].exercises.map(
        (e) => e.id,
      )).sort(),
    );
  });

  it("adapts every v1 lesson to an intro step plus legacy activities", () => {
    const pack = normalizePack(makeLegacyRawPack());
    const lesson = pack.lessons[0];
    expect(lesson.family).toBe("discovery");
    expect(lesson.revision).toBe(1);
    expect(lesson.entryStepId).toBe("lg-lesson-step-intro");
    expect(lesson.steps[0].activityId).toBe("lg-lesson-intro");
    expect(pack.activities["lg-lesson-intro"].kind).toBe("information");
    expect(lesson.completionPolicy).toEqual({
      kind: "legacy-success",
      exerciseIds: ["lg-ex-meet", "lg-ex-translate", "lg-ex-order", "lg-ex-dictation"],
    });
    expect(lesson.prerequisites).toEqual([]);
    const legacy = pack.activities["lg-ex-meet"];
    expect(legacy.kind).toBe("legacy");
    if (legacy.kind === "legacy") {
      expect(legacy.exercise.id).toBe("lg-ex-meet");
      expect(legacy.evidenceKey).toBe("lg-ex-meet");
    }
  });

  it("preserves the v1 meet-first exercise order through the adapter", () => {
    const pack = normalizePack(makeLegacyRawPack());
    const lesson = pack.lessons[0];
    expect(lesson.legacyExercises[0].id).toBe("lg-ex-meet");
    expect(lesson.legacyExercises[0].kind).toBe("choice");
  });

  it("maps v1 prerequisites to legacy-success requirements", () => {
    const raw = makeLegacyRawPack();
    const lessons = raw.lessons as Array<{ prerequisites: string[] }>;
    lessons[0].prerequisites = ["lg-earlier"];
    (raw.lessons as unknown[]).unshift({
      ...(lessons[0] as unknown as Record<string, unknown>),
      id: "lg-earlier",
      prerequisites: [],
      exercises: (
        lessons[0] as unknown as { exercises: Array<Record<string, unknown>> }
      ).exercises.map((e, i) => ({ ...e, id: `lg-early-${i}`, prompt: `early ${i} prompt` })),
    });
    const pack = normalizePack(raw);
    const lesson = pack.lessons.find((l) => l.id === "lg-lesson")!;
    expect(lesson.prerequisites).toEqual([
      { lessonId: "lg-earlier", requirement: { kind: "legacy-success" } },
    ]);
  });

  it("embeds retained legacy exercises in v2 packs without reusing new IDs", () => {
    const pack = normalizePack(makePilotPack());
    expect(Object.keys(pack.exercisesById)).toHaveLength(0);
    expect(pack.lessons.every((l) => l.legacyExercises.length === 0)).toBe(true);
  });

  it("rejects non-empty coming-soon v2 packs", () => {
    const raw = makePilotPack();
    (raw as Record<string, unknown>).status = "coming-soon";
    expect(() => normalizePack(raw)).toThrow(/coming-soon/i);
  });
});
