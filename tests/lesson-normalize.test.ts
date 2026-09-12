import { describe, it, expect } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { validateV2Pack } from "@/features/course-pack/schema-v2";
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
    // Every lesson, not just the first: the fixture is a small course now, and
    // each authored exercise must keep its own identity through the adapter.
    expect(Object.keys(pack.exercisesById).sort()).toEqual(
      (raw.lessons as Array<{ exercises: Array<{ id: string }> }>)
        .flatMap((lesson) => lesson.exercises.map((e) => e.id))
        .sort(),
    );
  });

  it("adapts every v1 lesson to an intro step plus faithful activities", () => {
    const pack = normalizePack(makeLegacyRawPack());
    const lesson = pack.lessons[0];
    expect(lesson.family).toBe("discovery");
    expect(lesson.revision).toBe(1);
    expect(lesson.entryStepId).toBe("lg-lesson-step-intro");
    expect(lesson.steps[0].activityId).toBe("lg-lesson-intro");
    expect(pack.activities["lg-lesson-intro"].kind).toBe("information");
    expect(lesson.completionPolicy).toEqual({
      kind: "legacy-success",
      exerciseIds: [
        "lg-ex-meet",
        "lg-ex-translate",
        "lg-ex-think",
        "lg-ex-order",
        "lg-ex-dictation",
        "lg-ex-please",
        "lg-ex-greeting",
      ],
    });
    expect(lesson.prerequisites).toEqual([]);
    // choice keeps its identity and compares the chosen option text.
    const meet = pack.activities["lg-ex-meet"];
    expect(meet.kind).toBe("selection");
    if (meet.kind === "selection") {
      expect(meet.options).toEqual([
        { id: "hola", text: "¡Hola!" },
        { id: "adios", text: "¡Adiós!" },
        { id: "gracias", text: "Gracias." },
      ]);
      expect(meet.acceptedIds).toEqual(["hola"]);
      expect(meet.multiple).toBe(false);
      expect(meet.evidenceKey).toBe("lg-ex-meet");
    }
    // translate reuses the full answer contract.
    const tr = pack.activities["lg-ex-translate"];
    expect(tr.kind).toBe("text");
    if (tr.kind === "text") expect(tr.answer.answers).toEqual(["Gracias."]);
    // order derives the accepted token permutation from its answers.
    const ord = pack.activities["lg-ex-order"];
    expect(ord.kind).toBe("ordering");
    if (ord.kind === "ordering")
      expect(ord.acceptedOrders).toEqual([["t1", "t2", "t3", "t4"]]);
    // dictation keeps its audio behind a stimulus reference.
    const dic = pack.activities["lg-ex-dictation"];
    expect(dic.kind).toBe("text");
    if (dic.kind === "text") {
      expect(dic.stimulusId).toBe("lg-ex-dictation-audio");
      expect(pack.stimuli["lg-ex-dictation-audio"]).toMatchObject({
        kind: "audio",
        mediaId: "aud-basic",
      });
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
      ).exercises.map((e, i) => ({
        ...e,
        id: `lg-early-${i}`,
        // A cloze prompt carries its blank, so renaming the prompt wholesale
        // would strip it and the v1 validator would rightly refuse the pack.
        prompt: e.kind === "cloze" ? `early ${i} prompt ___` : `early ${i} prompt`,
      })),
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


it("preserves explicit old completion requirements when the v2 policy changes", () => {
  const raw = validateV2Pack(makePilotPack());
  const old = validatePack(makeLegacyRawPack()).lessons[0].exercises[0];
  Object.assign(raw.lessons[0], {legacyExercises: [old], legacyCompletionExerciseIds: [old.id]});
  expect(normalizePack(raw).lessons[0].legacyCompletionExerciseIds).toEqual([old.id]);
});
it("rejects a migration that omits old completion requirements", () => {
  const raw = validateV2Pack(makePilotPack());
  Object.assign(raw.lessons[0], {legacyExercises: [validatePack(makeLegacyRawPack()).lessons[0].exercises[0]]});
  expect(() => normalizePack(raw)).toThrow(/legacy completion/i);
});
it("rejects completion credit for an exercise outside that lesson", () => {
  const raw = validateV2Pack(makePilotPack());
  Object.assign(raw.lessons[0], {legacyCompletionExerciseIds: ['unknown-exercise']});
  expect(() => normalizePack(raw)).toThrow(/legacy completion/i);
});
it('rejects conflicting legacy completion contracts', () => {
  const raw = validateV2Pack(makePilotPack());
  const old = validatePack(makeLegacyRawPack()).lessons[0].exercises.slice(0, 2);
  Object.assign(raw.lessons[0], { legacyExercises: old,
    legacyCompletionExerciseIds: [old[0].id],
    completionPolicy: {kind: 'legacy-success', exerciseIds: old.map(e => e.id)},
  });
  expect(() => normalizePack(raw)).toThrow(/legacy completion/i);
});
