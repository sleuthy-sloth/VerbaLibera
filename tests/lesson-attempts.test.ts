import { describe, it, expect } from "vitest";
import {
  mergeLearningEvents,
  parseLearningEvent,
  projectLessonEvidence,
  resumeSession,
  type ActivityAttempt,
  type LearningEvent,
  type LessonCheckpoint,
  type StepCompletion,
} from "@/features/course-pack/attempts";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import { makePilotPack, makeLegacyRawPack } from "./fixtures/lesson-variety";

const pilot = () => normalizePack(makePilotPack());
const AT = "2026-09-08T10:00:00.000Z";

const attempt = (over: Partial<ActivityAttempt> = {}): ActivityAttempt => ({
  eventVersion: 2,
  type: "attempt",
  id: "att-1",
  packId: "it-variety-pilot",
  packVersion: "0.1.0",
  lessonId: "it-cafe-story",
  lessonRevision: 1,
  stepId: "st-s2",
  activityId: "act-story-evidence",
  activityRevision: 1,
  evidenceKey: "ev-story-evidence",
  response: { kind: "selection", ids: ["un-caffe"] },
  assistance: [],
  evaluation: { outcome: "correct", independent: true, feedback: "Good." },
  at: AT,
  ...over,
});

const completion = (over: Partial<StepCompletion> = {}): StepCompletion => ({
  eventVersion: 2,
  type: "step-completed",
  id: "cmp-1",
  packId: "it-variety-pilot",
  packVersion: "0.1.0",
  lessonId: "it-cafe-story",
  lessonRevision: 1,
  stepId: "st-s2",
  attemptId: "att-1",
  at: AT,
  ...over,
});

const v1event = (over: Record<string, unknown> = {}) => ({
  id: "v1-1",
  packId: "it-variety-pilot",
  version: "0.1.0",
  exerciseId: "lg-ex-meet",
  at: AT,
  correct: true,
  revealed: false,
  ...over,
});

describe("lesson attempts", () => {
  it("preserves v1 imports byte-for-byte at object level", () => {
    const event = v1event();
    expect(mergeLearningEvents([event])).toEqual([event]);
  });

  it("round-trips mixed events with duplicate idempotency", () => {
    const events: LearningEvent[] = [
      v1event({ at: "2026-09-08T10:00:00.000Z" }),
      attempt({ at: "2026-09-08T10:00:01.000Z" }),
      completion({ at: "2026-09-08T10:00:02.000Z" }),
    ];
    expect(mergeLearningEvents(events, [v1event({ at: "2026-09-08T10:00:00.000Z" }), attempt({ at: "2026-09-08T10:00:01.000Z" })])).toEqual(events);
  });

  it("rejects conflicting IDs atomically", () => {
    expect(() =>
      mergeLearningEvents([attempt()], [attempt({ evaluation: { outcome: "incorrect", independent: false, feedback: "x" } })]),
    ).toThrow(/Conflicting/);
  });

  it("rejects unknown event versions explicitly", () => {
    expect(() =>
      parseLearningEvent({ ...attempt(), eventVersion: 3 } as unknown),
    ).toThrow(/event version/i);
    expect(() =>
      parseLearningEvent({ ...attempt(), type: "nap" } as unknown),
    ).toThrow(/event type/i);
  });

  it("isolates other packs from projection", () => {
    const pack = pilot();
    const evidence = projectLessonEvidence(pack, [
      attempt({ packId: "fr-other" }),
      completion({ packId: "fr-other", attemptId: "att-1" }),
    ]);
    expect(evidence.participationCompleted).toEqual([]);
    expect(evidence.evidence).toEqual({});
  });

  it("keeps revealed answers out of independent evidence on reload", () => {
    const pack = pilot();
    const evidence = projectLessonEvidence(pack, [
      attempt({ assistance: ["model"], evaluation: { outcome: "correct", independent: false, feedback: "Shown." } }),
    ]);
    expect(evidence.evidence["ev-story-evidence"]?.successes).toBe(0);
    expect(evidence.evidence["ev-story-evidence"]?.failures).toBe(1);
    expect(evidence.skillCounts.reading.assisted).toBe(1);
    expect(evidence.skillCounts.reading.independent).toBe(0);
  });

  it("quarantines attempts from changed revisions instead of applying them", () => {
    const pack = pilot();
    const evidence = projectLessonEvidence(pack, [
      attempt({ activityRevision: 2 }),
      attempt({ id: "att-2", lessonRevision: 9 }),
    ]);
    expect(evidence.evidence).toEqual({});
    expect(evidence.quarantined).toEqual(expect.arrayContaining(["att-1", "att-2"]));
  });

  it("requires graded completions to reference a matching attempt", () => {
    const pack = pilot();
    expect(() =>
      projectLessonEvidence(pack, [completion({ attemptId: "missing" })]),
    ).toThrow(/matching attempt/i);
    expect(() =>
      projectLessonEvidence(pack, [completion({ attemptId: undefined })]),
    ).toThrow(/matching attempt/i);
  });

  it("completes participation along the chosen path only", () => {
    const pack = pilot();
    const story: LearningEvent[] = [
      { ...completion({ id: "c-s1", stepId: "st-s1", attemptId: undefined }) },
      attempt(),
      completion(),
    ];
    const partial = projectLessonEvidence(pack, story);
    // st-s3/st-s4 not done: no participation credit yet.
    expect(partial.participationCompleted).not.toContain("it-cafe-story");
    const full: LearningEvent[] = [
      ...story,
      { ...completion({ id: "c-s3", stepId: "st-s3", attemptId: "att-3" }) },
      attempt({ id: "att-3", stepId: "st-s3", activityId: "act-story-sequence", evidenceKey: "ev-story-sequence", response: { kind: "ordering", ids: ["t-saluta", "t-ordina", "t-ringrazia"] } }),
      { ...completion({ id: "c-s4", stepId: "st-s4", attemptId: "att-4" }) },
      attempt({ id: "att-4", stepId: "st-s4", activityId: "it-cafe-order-text", evidenceKey: "ev-cafe-order", response: { kind: "text", text: "Un caffè, per favore." } }),
    ];
    expect(
      projectLessonEvidence(pack, full).participationCompleted,
    ).toContain("it-cafe-story");
  });

  it("grants legacy credit from v1 success without relocking", () => {
    const pack = pilot();
    expect(projectLessonEvidence(pack, []).legacyCredits).toEqual([]);
    // v2 lessons use evidence policies, so legacy credits stay empty here;
    // the legacy path is covered by the adapter contract (legacy-success policy).
    const legacy = normalizePack(makeLegacyRawPack());
    const credited = projectLessonEvidence(legacy, [
      { ...v1event(), packId: "lg-legacy", exerciseId: "lg-ex-meet" },
      { ...v1event(), packId: "lg-legacy", id: "v1-2", exerciseId: "lg-ex-translate" },
      { ...v1event(), packId: "lg-legacy", id: "v1-3", exerciseId: "lg-ex-order" },
      { ...v1event(), packId: "lg-legacy", id: "v1-4", exerciseId: "lg-ex-dictation" },
    ]);
    expect(credited.legacyCredits).toContain("lg-lesson");
  });

  it("resumes a compatible checkpoint and restarts on drift", () => {
    const pack = pilot();
    const checkpoint: LessonCheckpoint = {
      packId: "it-variety-pilot",
      lessonId: "it-cafe-conversation",
      revision: 1,
      stepId: "cv-s3",
      selectedBranches: { "cv-s2": "r-formal" },
      assistance: ["hint"],
      draft: null,
      at: AT,
    };
    const resumed = resumeSession(pack, checkpoint, []);
    expect(resumed.kind).toBe("resume");
    if (resumed.kind === "resume") {
      expect(resumed.session.activeStepId).toBe("cv-s3");
      expect(resumed.session.visitedStepIds).toEqual(["cv-s1", "cv-s2", "cv-s3"]);
      expect(resumed.session.accumulatedAssistance).toEqual(["hint"]);
    }
    const drifted = resumeSession(pack, { ...checkpoint, revision: 7 }, []);
    expect(drifted).toMatchObject({ kind: "restart" });
    const wrongStep = resumeSession(pack, { ...checkpoint, stepId: "nope" }, []);
    expect(wrongStep).toMatchObject({ kind: "restart" });
  });
});
