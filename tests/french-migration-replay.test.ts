import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { migratePackV1ToV2, normalizePack } from "@/features/course-pack/normalize-pack";
import { projectLessonEvidence } from "@/features/course-pack/attempts";
import type {
  ActivityAttempt,
  LearningEvent,
  StepCompletion,
} from "@/features/course-pack/attempts";
import type { PracticeEvent } from "@/features/course-pack/progress";
import type { Activity, RuntimePack } from "@/features/course-pack/lesson-runtime";
import { evaluateActivity } from "@/features/course-pack/activity-evaluation";
import { decodeBackupEnvelope, encodeBackup } from "@/features/course-pack/storage";

/**
 * Phase 2A step 2: replay proof for stored learner history.
 *
 * Parity of the pack objects is not the claim that matters to a learner. The
 * claim is that history recorded against the v1 pack still projects to the same
 * completion, review schedule and skill counts against the migrated pack. Three
 * histories are replayed through `projectLessonEvidence` against both runtime
 * packs and must agree exactly:
 *
 * 1. legacy `PracticeEvent` rows (a learner who never saw a v2 pack),
 * 2. v2 `attempt`/`step-completed` rows (a learner practising after a migration),
 * 3. a format-two exported backup containing both.
 *
 * `Evidence` carries the SRS state, so equal evidence is equal due schedules —
 * not merely equal counts. Anything the projection cannot match is quarantined,
 * and a quarantine is a difference the test would see.
 */

const FRENCH = path.join(process.cwd(), "courses/french/manifest.json");
const AT = "2026-09-08T09:00:00.000Z";

const packs = (): { v1: RuntimePack; v2: RuntimePack } => {
  const source = JSON.parse(readFileSync(FRENCH, "utf8")) as Record<string, unknown>;
  return { v1: normalizePack(source), v2: normalizePack(migratePackV1ToV2(source)) };
};

/** A correct response for the activity, plus the evaluator's own verdict. */
function correctAnswer(activity: Activity): { response: ActivityAttempt["response"]; evaluation: ActivityAttempt["evaluation"] } | null {
  const response = ((): ActivityAttempt["response"] | null => {
    switch (activity.kind) {
      case "text":
        return { kind: "text", text: activity.answer.answers[0] ?? "" };
      case "selection":
        return { kind: "selection", ids: [activity.acceptedIds[0] ?? ""] };
      case "ordering":
        return { kind: "ordering", ids: activity.acceptedOrders[0] ?? [] };
      case "cloze":
        return {
          kind: "cloze",
          values: Object.fromEntries(
            Object.entries(activity.blanks).map(([blank, spec]) => [blank, spec.answers[0] ?? ""]),
          ),
        };
      default:
        return null;
    }
  })();
  if (!response) return null;
  // Use the real evaluator, so the claimed verdict cannot disagree with the
  // activity the way a hand-written outcome would.
  return { response, evaluation: evaluateActivity(activity, response, []) };
}

/** Legacy rows for one lesson: what the v1 player wrote. */
function legacyHistory(pack: RuntimePack, lessonIndex: number): PracticeEvent[] {
  const lesson = pack.lessons[lessonIndex]!;
  return lesson.legacyCompletionExerciseIds.map((exerciseId) => ({
    id: `v1-${exerciseId}`,
    packId: pack.id,
    version: pack.version,
    exerciseId,
    at: AT,
    correct: true,
    revealed: false,
  }));
}

/** v2 rows for one lesson's graded steps, optionally leaving it unfinished. */
function lessonHistory(
  pack: RuntimePack,
  lessonIndex: number,
  options: { complete: boolean },
): LearningEvent[] {
  const lesson = pack.lessons[lessonIndex]!;
  const events: LearningEvent[] = [];
  for (const step of lesson.steps) {
    const activity = pack.activities[step.activityId];
    if (!activity) continue;
    if (activity.kind === "information") {
      if (options.complete)
        events.push({
          eventVersion: 2,
          type: "step-completed",
          id: `cmp-${step.id}`,
          packId: pack.id,
          packVersion: pack.version,
          lessonId: lesson.id,
          lessonRevision: lesson.revision,
          stepId: step.id,
          at: AT,
        } satisfies StepCompletion);
      continue;
    }
    const answered = correctAnswer(activity);
    if (!answered) continue;
    const attempt: ActivityAttempt = {
      eventVersion: 2,
      type: "attempt",
      id: `att-${step.id}`,
      packId: pack.id,
      packVersion: pack.version,
      lessonId: lesson.id,
      lessonRevision: lesson.revision,
      stepId: step.id,
      activityId: activity.id,
      activityRevision: activity.revision,
      evidenceKey: "evidenceKey" in activity ? activity.evidenceKey : undefined,
      response: answered.response,
      assistance: [],
      evaluation: answered.evaluation,
      at: AT,
    };
    events.push(attempt);
    if (options.complete)
      events.push({
        eventVersion: 2,
        type: "step-completed",
        id: `cmp-${step.id}`,
        packId: pack.id,
        packVersion: pack.version,
        lessonId: lesson.id,
        lessonRevision: lesson.revision,
        stepId: step.id,
        attemptId: attempt.id,
        at: AT,
      } satisfies StepCompletion);
    // Unfinished: stop after the first two graded steps.
    else if (events.filter((event) => (event as { type?: string }).type === "attempt").length >= 2)
      break;
  }
  return events;
}

const projection = (pack: RuntimePack, events: LearningEvent[]) => {
  const evidence = projectLessonEvidence(pack, events);
  return {
    participationCompleted: [...evidence.participationCompleted].sort(),
    legacyCredits: [...evidence.legacyCredits].sort(),
    quarantined: [...evidence.quarantined].sort(),
    evidence,
    skillCounts: evidence.skillCounts,
  };
};

describe("French migration: stored history replays without loss", () => {
  it("projects a legacy-only history identically against both packs", () => {
    const { v1, v2 } = packs();
    const events = legacyHistory(v1, 0);
    expect(events.length).toBeGreaterThan(3);
    const before = projection(v1, events);
    const after = projection(v2, events);
    expect(after).toEqual(before);
    // Non-vacuous: the history actually produced credit and no quarantine.
    expect(before.quarantined).toEqual([]);
    expect(before.legacyCredits).toContain(v1.lessons[0]!.id);
  });

  it("projects post-migration attempts and completions identically", () => {
    const { v1, v2 } = packs();
    const events = lessonHistory(v1, 0, { complete: true });
    const before = projection(v1, events);
    const after = projection(v2, events);
    expect(after).toEqual(before);
    expect(before.quarantined).toEqual([]);
    expect(before.participationCompleted).toContain(v1.lessons[0]!.id);
    expect(Object.keys(before.evidence.evidence).length).toBeGreaterThan(0);
  });

  it("keeps an unfinished lesson unfinished, with its practice preserved", () => {
    const { v1, v2 } = packs();
    const events = lessonHistory(v1, 1, { complete: false });
    const before = projection(v1, events);
    const after = projection(v2, events);
    expect(after).toEqual(before);
    expect(before.quarantined).toEqual([]);
    expect(before.participationCompleted).not.toContain(v1.lessons[1]!.id);
    expect(Object.keys(before.evidence.evidence).length).toBeGreaterThan(0);
  });

  it("replays a mixed history through an exported backup without loss", () => {
    const { v1, v2 } = packs();
    const events = [
      ...legacyHistory(v1, 0),
      ...lessonHistory(v1, 1, { complete: true }),
      ...lessonHistory(v1, 2, { complete: false }),
    ];
    const legacy = events.filter(
      (event): event is PracticeEvent => (event as { type?: string }).type === undefined,
    );
    const lessonEvents = events.filter(
      (event): event is ActivityAttempt | StepCompletion => (event as { type?: string }).type !== undefined,
    );
    const envelope = encodeBackup(legacy, lessonEvents);
    expect(envelope.format).toBe(2);

    // Round-trip the envelope exactly as an import does, then replay it.
    const decoded = decodeBackupEnvelope(JSON.stringify(envelope));
    const replayed: LearningEvent[] = [...decoded.events, ...decoded.lessonEvents];
    const before = projection(v1, replayed);
    const after = projection(v2, replayed);
    expect(after).toEqual(before);
    expect(before.quarantined).toEqual([]);
    // Lesson 1 practised to the end after migration; lesson 2 was left
    // half-done; lesson 0's credit comes from the legacy rows alone.
    expect(before.participationCompleted).toEqual([v1.lessons[1]!.id]);
    expect(before.legacyCredits).toContain(v1.lessons[0]!.id);
    expect(Object.keys(before.evidence.evidence).length).toBeGreaterThan(3);
  });
});
