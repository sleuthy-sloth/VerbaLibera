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

  it("cafe lesson covers listening, cloze, ordering, production, and transfer", () => {
    const pack = italian();
    const lesson = pack.lessons.find((l) => l.id === "it-cafe-order-foundation")!;
    expect(lesson).toBeDefined();
    expect(lesson.prerequisites[0]?.lessonId).toBe("it-invitations-foundation");
    expect(lesson.family).toBe("conversation");
    const activities = lesson.steps.map((step) => pack.activities[step.activityId]);
    expect(activities.some((activity) => "skills" in activity && activity.skills.includes("listening"))).toBe(true);
    expect(activities.some((activity) => activity.kind === "cloze")).toBe(true);
    expect(activities.some((activity) => activity.kind === "ordering")).toBe(true);
    expect(activities.some((activity) => activity.kind === "text" && "skills" in activity && activity.skills.includes("writing"))).toBe(true);
    expect(activities.some((activity) => "prompt" in activity && activity.prompt.includes("Transfer:"))).toBe(true);
    expect(pack.media.some((media) => media.id === "it-polite-coffee-audio")).toBe(true);
  });
});
