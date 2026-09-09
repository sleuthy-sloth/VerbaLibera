import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizePack } from "@/features/course-pack/normalize-pack";

/** Pins the authored pilot lessons so later edits cannot silently drop them. */
const italian = () =>
  normalizePack(JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")));

describe("lesson variety pilots", () => {
  it("food lesson is a story with evidence, sequence, and transfer steps", () => {
    const pack = italian();
    const lesson = pack.lessons.find((l) => l.id === "it-food-foundation")!;
    expect(lesson.family).toBe("story");
    for (const id of ["it-food-story-q1", "it-food-story-q2", "it-food-story-seq", "it-food-story-transfer"])
      expect(pack.activities[id]).toBeDefined();
    const story = pack.stimuli["it-food-story"];
    expect(story.kind).toBe("text");
    if (story.kind === "text") expect(story.translation).toBeTruthy();
    const transfer = pack.activities["it-food-story-transfer"];
    expect(transfer.kind).toBe("text");
    // Legacy credit survives the pilot: old completions stay unlocked.
    expect(lesson.legacyCompletionExerciseIds.length).toBeGreaterThan(0);
  });

  it("requests lesson is a conversation with a branched reply", () => {
    const pack = italian();
    const lesson = pack.lessons.find((l) => l.id === "it-requests-foundation")!;
    expect(lesson.family).toBe("conversation");
    const reply = pack.activities["it-requests-reply"];
    expect(reply.kind).toBe("dialogue-choice");
    if (reply.kind === "dialogue-choice") {
      expect(reply.acceptedIds).toHaveLength(1);
      const step = lesson.steps.find((s) => s.activityId === "it-requests-reply")!;
      expect((step.branches ?? {})[reply.acceptedIds[0]]).toBe("it-requests-foundation-step-transfer");
    }
    const dialogue = pack.stimuli["it-requests-dialogue"];
    expect(dialogue.kind).toBe("dialogue");
  });
});
