import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";

import { normalizePack } from "@/features/course-pack/normalize-pack";
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
import { CourseWorkspace } from "@/features/course-pack/CourseWorkspace";
import {
  createMemoryLessonPractice,
  type CourseEnvironment,
} from "@/features/course-pack/environment";

/**
 * Phase 2A step 2, after the flip: the claim a learner cares about.
 *
 * Parity of pack objects is not the thing that matters to somebody who has been
 * using the course. Two histories are replayed against the **migrated** French
 * pack and must still produce credit, evidence and participation:
 *
 * 1. legacy `PracticeEvent` rows, written by the v1 player and keyed by exercise
 *    id — this is the pre-migration learner;
 * 2. v2 `attempt`/`step-completed` rows — this is the same learner continuing.
 *
 * The component half at the bottom is the part no projection-level assertion can
 * make: it renders the real course boundary and checks that a pre-migration
 * learner sees their finished lesson and their next one unlocked, rather than a
 * course path that has silently reset.
 */

const FRENCH = path.join(process.cwd(), "courses/french/manifest.json");
const AT = "2026-09-08T09:00:00.000Z";

const pack = (): RuntimePack =>
  normalizePack(JSON.parse(readFileSync(FRENCH, "utf8")) as unknown);

/** A correct response for the activity, plus the evaluator's own verdict. */
function correctAnswer(activity: Activity): {
  response: ActivityAttempt["response"];
  evaluation: ActivityAttempt["evaluation"];
} | null {
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
function legacyHistory(host: RuntimePack, lessonIndex: number): PracticeEvent[] {
  const lesson = host.lessons[lessonIndex]!;
  return lesson.legacyCompletionExerciseIds.map((exerciseId) => ({
    id: `v1-${exerciseId}`,
    packId: host.id,
    version: host.version,
    exerciseId,
    at: AT,
    correct: true,
    revealed: false,
  }));
}

/** v2 rows for one lesson's steps, optionally leaving it unfinished. */
function lessonHistory(
  host: RuntimePack,
  lessonIndex: number,
  options: { complete: boolean },
): LearningEvent[] {
  const lesson = host.lessons[lessonIndex]!;
  const events: LearningEvent[] = [];
  for (const step of lesson.steps) {
    const activity = host.activities[step.activityId];
    if (!activity) continue;
    if (activity.kind === "information") {
      if (options.complete)
        events.push({
          eventVersion: 2,
          type: "step-completed",
          id: `cmp-${step.id}`,
          packId: host.id,
          packVersion: host.version,
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
      packId: host.id,
      packVersion: host.version,
      lessonId: lesson.id,
      lessonRevision: lesson.revision,
      stepId: step.id,
      activityId: activity.id,
      activityRevision: activity.revision,
      evidenceKey: "evidenceKey" in activity ? activity.evidenceKey : undefined,
      response: answered.response,
      evaluation: answered.evaluation,
      assistance: [],
      at: AT,
    };
    events.push(attempt);
    if (options.complete)
      events.push({
        eventVersion: 2,
        type: "step-completed",
        id: `cmp-${step.id}`,
        packId: host.id,
        packVersion: host.version,
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

describe("migrated French: stored history still counts", () => {
  it("keeps legacy credit for a learner whose practice predates the v2 pack", () => {
    const host = pack();
    const events = [...legacyHistory(host, 0), ...legacyHistory(host, 1)];
    const evidence = projectLessonEvidence(host, events);
    expect(evidence.quarantined).toEqual([]);
    expect(evidence.legacyCredits).toContain(host.lessons[0]!.id);
    expect(evidence.legacyCredits).toContain(host.lessons[1]!.id);
    // Legacy rows are credit, not fabricated review state: no SRS schedule is
    // invented for practice the old player never graded into one.
    expect(evidence.evidence).toEqual({});
    expect(evidence.participationCompleted).toEqual([]);
  });

  it("keeps credit when only one exercise was missed", () => {
    const host = pack();
    const events = legacyHistory(host, 0);
    const missed = { ...events[0]!, correct: false } as PracticeEvent;
    const evidence = projectLessonEvidence(host, [missed, ...events.slice(1)]);
    expect(evidence.legacyCredits).not.toContain(host.lessons[0]!.id);
    expect(evidence.quarantined).toEqual([]);
  });

  it("credits post-migration practice on the same activities", () => {
    const host = pack();
    const events = lessonHistory(host, 0, { complete: true });
    const evidence = projectLessonEvidence(host, events);
    expect(evidence.quarantined).toEqual([]);
    expect(evidence.participationCompleted).toContain(host.lessons[0]!.id);
    expect(Object.keys(evidence.evidence).length).toBeGreaterThan(0);
    const skills = Object.values(evidence.skillCounts).reduce(
      (total, counts) => total + counts.independent,
      0,
    );
    expect(skills).toBeGreaterThan(0);
  });

  it("keeps an unfinished lesson unfinished, with its practice preserved", () => {
    const host = pack();
    const events = lessonHistory(host, 1, { complete: false });
    const evidence = projectLessonEvidence(host, events);
    expect(evidence.quarantined).toEqual([]);
    expect(evidence.participationCompleted).not.toContain(host.lessons[1]!.id);
    expect(Object.keys(evidence.evidence).length).toBeGreaterThan(0);
  });

  it("replays a mixed history through an exported backup without loss", () => {
    const host = pack();
    const events = [
      ...legacyHistory(host, 0),
      ...lessonHistory(host, 1, { complete: true }),
      ...lessonHistory(host, 2, { complete: false }),
    ];
    const legacy = events.filter(
      (event): event is PracticeEvent => (event as { type?: string }).type === undefined,
    );
    const lessonEvents = events.filter(
      (event): event is ActivityAttempt | StepCompletion =>
        (event as { type?: string }).type !== undefined,
    );
    const envelope = encodeBackup(legacy, lessonEvents);
    expect(envelope.format).toBe(2);

    // Round-trip exactly as an import does, then replay.
    const decoded = decodeBackupEnvelope(JSON.stringify(envelope));
    const evidence = projectLessonEvidence(host, [...decoded.events, ...decoded.lessonEvents]);
    expect(evidence.quarantined).toEqual([]);
    expect(evidence.participationCompleted).toEqual([host.lessons[1]!.id]);
    expect(evidence.legacyCredits).toContain(host.lessons[0]!.id);
    expect(Object.keys(evidence.evidence).length).toBeGreaterThan(3);
  });
});

describe("migrated French: the course path remembers a pre-migration learner", () => {
  const environment = (events: PracticeEvent[]): CourseEnvironment => ({
    capabilities: {
      accounts: false,
      synchronization: false,
      offlineInstall: false,
      hostedNavigation: false,
    },
    practice: {
      getDurability: () => "durable",
      subscribeDurability: () => () => {},
      read: async () => events,
      write: async () => {},
    },
    lessonPractice: createMemoryLessonPractice(),
    loadPack: async () => {
      throw new Error("the migrated pack must load through loadCourse");
    },
    loadCourse: async () => pack(),
    resolveMedia: (url) => url,
    isInstalled: async () => false,
  });

  it("shows the finished lesson as complete and unlocks the next one", async () => {
    const host = pack();
    render(<CourseWorkspace environment={environment(legacyHistory(host, 0))} />);

    const path = await screen.findByRole("navigation", { name: "Course path" });
    // One of twenty-five, not zero: the pre-migration practice still counts.
    await waitFor(() =>
      expect(path.textContent).toContain(`1 of ${host.lessons.length}`),
    );
    expect(screen.getByRole("button", { name: host.lessons[1]!.title })).toBeEnabled();
    expect(screen.getByRole("button", { name: host.lessons[2]!.title })).toBeDisabled();
  });

  it("the same path shows nothing practised without that history", async () => {
    // The pair is what makes the assertion above mean something: the count and
    // the unlocked lesson come from the stored events, not from the pack.
    const host = pack();
    render(<CourseWorkspace environment={environment([])} />);

    const path = await screen.findByRole("navigation", { name: "Course path" });
    await waitFor(() => expect(path.textContent).toContain(`0 of ${host.lessons.length}`));
    expect(screen.getByRole("button", { name: host.lessons[1]!.title })).toBeDisabled();
  });
});
