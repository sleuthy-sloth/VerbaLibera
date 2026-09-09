import { describe, it, expect } from "vitest";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import { makePilotPack } from "./fixtures/lesson-variety";

describe("lesson schema v2", () => {
  it("accepts the three-family pilot pack", () => {
    const pack = normalizePack(makePilotPack());
    expect(pack.schemaVersion).toBe(2);
    expect(pack.lessons.map((l) => l.family)).toEqual([
      "story",
      "conversation",
      "listening",
    ]);
  });

  it("rejects a branch that cannot reach a real step", () => {
    const raw = makePilotPack();
    const lessons = raw.lessons as Array<{ steps: Array<{ branches: Record<string, string> }> }>;
    lessons[1].steps[0].branches = { "reply-order": "missing-step" };
    expect(() => normalizePack(raw)).toThrow(/step|branch/i);
  });

  it("rejects a branch on a non-dialogue activity", () => {
    const raw = makePilotPack();
    const lessons = raw.lessons as Array<{ steps: Array<{ branches: Record<string, string> }> }>;
    lessons[0].steps[1].branches = { "un-caffe": "st-s3" };
    expect(() => normalizePack(raw)).toThrow(/dialogue/i);
  });

  it("rejects a step graph cycle", () => {
    const raw = makePilotPack();
    const lessons = raw.lessons as Array<{ steps: Array<{ id: string; nextStepId: string | null }> }>;
    const first = lessons[0].steps[0];
    first.nextStepId = "st-s4";
    (lessons[0].steps[3] as { nextStepId: string | null }).nextStepId = "st-s1";
    expect(() => normalizePack(raw)).toThrow(/cycle/i);
  });

  it("rejects duplicate ordering token IDs", () => {
    const raw = makePilotPack();
    const activities = raw.activities as Array<{ id: string; tokens?: Array<{ id: string }> }>;
    const ordering = activities.find((a) => a.id === "act-story-sequence")!;
    ordering.tokens = [{ id: "t-dup" }, { id: "t-dup" }];
    expect(() => normalizePack(raw)).toThrow(/token/i);
  });

  it("rejects an accepted option outside the authored options", () => {
    const raw = makePilotPack();
    const activities = raw.activities as Array<{ id: string; acceptedIds?: string[] }>;
    activities.find((a) => a.id === "act-story-evidence")!.acceptedIds = ["nope"];
    expect(() => normalizePack(raw)).toThrow(/option/i);
  });

  it("rejects unknown media references", () => {
    const raw = makePilotPack();
    const stimuli = raw.stimuli as Array<{ id: string; mediaId?: string }>;
    stimuli.find((s) => s.id === "stm-cafe-audio")!.mediaId = "aud-missing";
    expect(() => normalizePack(raw)).toThrow(/media/i);
  });

  it("rejects unsupported schema versions", () => {
    const raw = makePilotPack();
    (raw as Record<string, unknown>).schemaVersion = 3;
    expect(() => normalizePack(raw)).toThrow(/version/i);
  });

  it("rejects graded activities where model reveal stays independent", () => {
    const raw = makePilotPack();
    const activities = raw.activities as Array<{ id: string; assistanceAffectsEvidence?: string[] }>;
    activities.find((a) => a.id === "it-cafe-order-text")!.assistanceAffectsEvidence = ["hint"];
    expect(() => normalizePack(raw)).toThrow(/model/i);
  });

  it("rejects orphaned authored activities", () => {
    const raw = makePilotPack();
    (raw.activities as unknown[]).push({
      kind: "information",
      id: "orphan-info",
      revision: 1,
      body: "Nobody references me.",
    });
    expect(() => normalizePack(raw)).toThrow(/orphan/i);
  });

  it("rejects evidence targets unreachable on a terminal path", () => {
    const raw = makePilotPack();
    const lessons = raw.lessons as Array<{ completionPolicy: { targets: Array<{ evidenceKey: string; successes: number }> } }>;
    lessons[0].completionPolicy.targets.push({ evidenceKey: "ev-never", successes: 1 });
    expect(() => normalizePack(raw)).toThrow(/evidence/i);
  });
});
