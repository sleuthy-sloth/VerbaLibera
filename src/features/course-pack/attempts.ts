import { z } from "zod";
import {
  eventSchema,
  type Evidence,
  type PracticeEvent,
} from "./progress";
import { scheduleReview } from "../srs/scheduler";
import { startLesson, type LessonSession } from "./lesson-session";
import type {
  Assistance,
  Response,
  RuntimePack,
  Skill,
  Step,
} from "./lesson-runtime";

/**
 * Versioned lesson events, evidence projection, and resume (plan Task 4).
 * V1 `PracticeEvent` rows are never modified: old events keep their exact
 * conflict identity, and format-one imports never invent completion events.
 */

const id = z.string().min(1).max(100);
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
const at = z.string().datetime();

const responseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().max(4000) }),
  z.object({ kind: z.literal("selection"), ids: z.array(z.string().max(100)).max(20) }),
  z.object({ kind: z.literal("ordering"), ids: z.array(z.string().max(100)).max(20) }),
  z.object({
    kind: z.literal("matching"),
    pairs: z
      .array(z.object({ leftId: z.string().max(100), rightId: z.string().max(100) }))
      .max(20),
  }),
  z.object({ kind: z.literal("cloze"), values: z.record(z.string(), z.string().max(1000)) }),
  z.object({ kind: z.literal("self"), rating: z.enum(["again", "comfortable"]) }),
  z.object({ kind: z.literal("continue") }),
]);

const evaluationSchema = z.object({
  outcome: z.enum(["correct", "incorrect", "self-assessed", "ungraded", "blocked"]),
  independent: z.boolean(),
  feedback: z.string().max(4000),
});

export const activityAttemptSchema = z.object({
  eventVersion: z.literal(2),
  type: z.literal("attempt"),
  id,
  packId: id,
  packVersion: version,
  lessonId: id,
  lessonRevision: z.number().int().positive(),
  stepId: id,
  activityId: id,
  activityRevision: z.number().int().positive(),
  evidenceKey: id.optional(),
  response: responseSchema,
  assistance: z.array(z.enum(["hint", "translation", "transcript", "model"])).max(4),
  evaluation: evaluationSchema,
  at,
});
export type ActivityAttempt = z.infer<typeof activityAttemptSchema>;

export const stepCompletionSchema = z.object({
  eventVersion: z.literal(2),
  type: z.literal("step-completed"),
  id,
  packId: id,
  packVersion: version,
  lessonId: id,
  lessonRevision: z.number().int().positive(),
  stepId: id,
  selectedBranchId: id.optional(),
  attemptId: id.optional(),
  at,
});
export type StepCompletion = z.infer<typeof stepCompletionSchema>;

export type LearningEvent = PracticeEvent | ActivityAttempt | StepCompletion;

/** Union parse for envelopes and server payloads (explicit version errors live in `parseLearningEvent`). */
export const learningEventSchema = z.union([
  eventSchema,
  activityAttemptSchema,
  stepCompletionSchema,
]);

/** V1 rows carry no `type` discriminator; read it tolerantly. */
const eventType = (event: LearningEvent): string | undefined =>
  (event as { type?: unknown }).type as string | undefined;

export function parseLearningEvent(raw: unknown): LearningEvent {
  if (raw && typeof raw === "object" && "eventVersion" in raw) {
    const versioned = raw as { eventVersion?: unknown; type?: unknown };
    if (versioned.eventVersion !== 2)
      throw new Error(
        `Unsupported event version ${JSON.stringify(versioned.eventVersion)}. Update the app to import or sync this practice.`,
      );
    if (versioned.type === "attempt") return activityAttemptSchema.parse(raw);
    if (versioned.type === "step-completed") return stepCompletionSchema.parse(raw);
    throw new Error(
      `Unknown lesson event type ${JSON.stringify(versioned.type)}. Update the app to import or sync this practice.`,
    );
  }
  return eventSchema.parse(raw);
}

export function mergeLearningEvents(
  ...collections: LearningEvent[][]
): LearningEvent[] {
  const map = new Map<string, LearningEvent>();
  for (const event of collections.flat()) {
    const parsed = parseLearningEvent(event);
    const old = map.get(parsed.id);
    if (old && JSON.stringify(old) !== JSON.stringify(parsed))
      throw new Error(
        "Conflicting practice mutation ID. Import was not applied.",
      );
    map.set(parsed.id, parsed);
  }
  return [...map.values()].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );
}

export type LessonEvidence = {
  /** Lessons whose required steps completed along the chosen path. */
  participationCompleted: string[];
  /** Lessons unlocked by legacy success credit (never relocked by v2). */
  legacyCredits: string[];
  /** SRS state per independent evidence key. */
  evidence: Record<string, Evidence>;
  /** Correct attempts per skill, split by independence. */
  skillCounts: Record<Skill, { independent: number; assisted: number }>;
  /** Event IDs held out of projection (revision drift, retired targets). */
  quarantined: string[];
};

const skillMode = (skills: Skill[]): Evidence["mode"] =>
  skills.includes("listening")
    ? "listening"
    : skills.includes("writing")
      ? "production"
      : "recognition";

export function projectLessonEvidence(
  pack: RuntimePack,
  events: LearningEvent[],
): LessonEvidence {
  const merged = mergeLearningEvents(events);
  const mine = merged.filter((e) => e.packId === pack.id);
  const v1 = mine.filter(
    (e): e is PracticeEvent => eventType(e) === undefined,
  );
  const attempts = mine.filter(
    (e): e is ActivityAttempt => eventType(e) === "attempt",
  );
  const completions = mine.filter(
    (e): e is StepCompletion => eventType(e) === "step-completed",
  );

  const lessons = new Map(pack.lessons.map((l) => [l.id, l]));
  const quarantined: string[] = [];

  // A graded step completion must reference its matching attempt.
  const attemptsById = new Map(attempts.map((a) => [a.id, a]));
  for (const completion of completions) {
    const lesson = lessons.get(completion.lessonId);
    if (!lesson || lesson.revision !== completion.lessonRevision) continue;
    const step = lesson.steps.find((s) => s.id === completion.stepId);
    if (!step) continue;
    const activity = pack.activities[step.activityId];
    if (!activity || activity.kind === "information" || activity.kind === "self-compare")
      continue;
    const attempt = completion.attemptId
      ? attemptsById.get(completion.attemptId)
      : undefined;
    if (
      !attempt ||
      attempt.lessonId !== completion.lessonId ||
      attempt.stepId !== completion.stepId ||
      attempt.activityId !== step.activityId ||
      attempt.lessonRevision !== completion.lessonRevision
    )
      throw new Error(
        `Step completion ${completion.id} has no matching attempt. Import was not applied.`,
      );
  }

  // Participation: walk the chosen path; every required step must be done.
  const completedByLesson = new Map<string, Set<string>>();
  for (const completion of completions) {
    const lesson = lessons.get(completion.lessonId);
    if (!lesson || lesson.revision !== completion.lessonRevision) {
      quarantined.push(completion.id);
      continue;
    }
    if (!completedByLesson.has(lesson.id)) completedByLesson.set(lesson.id, new Set());
    completedByLesson.get(lesson.id)!.add(completion.stepId);
  }
  const participationCompleted: string[] = [];
  for (const lesson of pack.lessons) {
    const done = completedByLesson.get(lesson.id);
    if (!done) continue;
    const steps = new Map<string, Step>(lesson.steps.map((s) => [s.id, s]));
    const trail: string[] = [];
    let current: string | null = lesson.entryStepId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      trail.push(current);
      const step: Step = steps.get(current)!;
      const branchKeys = Object.keys(step.branches ?? {});
      if (branchKeys.length > 0) {
        const completion = completions.find(
          (c) =>
            c.lessonId === lesson.id &&
            c.stepId === current &&
            c.lessonRevision === lesson.revision,
        );
        current =
          completion?.selectedBranchId &&
          step.branches![completion.selectedBranchId] !== undefined
            ? step.branches![completion.selectedBranchId]
            : null;
      } else {
        current = step.nextStepId;
      }
    }
    if (trail.every((stepId) => !steps.get(stepId)!.required || done.has(stepId)))
      participationCompleted.push(lesson.id);
  }

  // Legacy credit: v1 success on every required exercise of the policy.
  const successByExercise = new Map<string, boolean>();
  for (const event of v1) {
    if (event.correct && !event.revealed) successByExercise.set(event.exerciseId, true);
    else if (!successByExercise.has(event.exerciseId))
      successByExercise.set(event.exerciseId, false);
  }
  const legacyCredits: string[] = [];
  for (const lesson of pack.lessons) {
    if (lesson.completionPolicy.kind !== "legacy-success") continue;
    if (
      lesson.completionPolicy.exerciseIds.length > 0 &&
      lesson.completionPolicy.exerciseIds.every((id) => successByExercise.get(id))
    )
      legacyCredits.push(lesson.id);
  }

  // Independent evidence SRS + skill counts from current-revision attempts.
  const evidence: Record<string, Evidence> = {};
  const skillCounts = Object.fromEntries(
    (["reading", "listening", "writing", "speaking", "grammar", "vocabulary"] as Skill[]).map(
      (skill) => [skill, { independent: 0, assisted: 0 }],
    ),
  ) as Record<Skill, { independent: number; assisted: number }>;
  for (const attempt of attempts) {
    const lesson = lessons.get(attempt.lessonId);
    const activity = pack.activities[attempt.activityId];
    if (
      !lesson ||
      !activity ||
      lesson.revision !== attempt.lessonRevision ||
      ("revision" in activity && activity.revision !== attempt.activityRevision)
    ) {
      quarantined.push(attempt.id);
      continue;
    }
    if (attempt.evaluation.outcome === "correct" && "skills" in activity) {
      for (const skill of activity.skills) {
        if (attempt.evaluation.independent) skillCounts[skill].independent += 1;
        else skillCounts[skill].assisted += 1;
      }
    }
    if (
      !attempt.evidenceKey ||
      attempt.evaluation.outcome === "blocked" ||
      attempt.evaluation.outcome === "ungraded" ||
      attempt.evaluation.outcome === "self-assessed"
    )
      continue;
    const eventAt = new Date(attempt.at);
    const previous: Evidence = evidence[attempt.evidenceKey] ?? {
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueAt: eventAt,
      lapseCount: 0,
      lastReviewedAt: eventAt,
      lastQuality: 0 as const,
      lastLatencyMs: null,
      successes: 0,
      failures: 0,
      mode: "skills" in activity ? skillMode(activity.skills) : "recognition",
    };
    const success =
      attempt.evaluation.outcome === "correct" && attempt.evaluation.independent;
    evidence[attempt.evidenceKey] = {
      ...scheduleReview(previous, success ? 4 : 1, eventAt),
      mode: previous.mode,
      successes: previous.successes + (success ? 1 : 0),
      failures: previous.failures + (success ? 0 : 1),
    };
  }

  return {
    participationCompleted,
    legacyCredits,
    evidence,
    skillCounts,
    quarantined,
  };
}

// ---------------------------------------------------------- checkpoint/resume

export const lessonCheckpointSchema = z.object({
  packId: id,
  lessonId: id,
  revision: z.number().int().positive(),
  stepId: id,
  selectedBranches: z.record(z.string(), z.string()),
  assistance: z.array(z.enum(["hint", "translation", "transcript", "model"])).max(8),
  draft: responseSchema.nullable(),
  at,
});
export type LessonCheckpoint = z.infer<typeof lessonCheckpointSchema>;

export type ResumeResult =
  | { kind: "resume"; session: LessonSession }
  | { kind: "restart"; explanation: string };

export function resumeSession(
  pack: RuntimePack,
  checkpoint: LessonCheckpoint,
  events: LearningEvent[],
): ResumeResult {
  if (checkpoint.packId !== pack.id)
    return { kind: "restart", explanation: "This checkpoint belongs to another course." };
  const lesson = pack.lessons.find((l) => l.id === checkpoint.lessonId);
  if (!lesson)
    return {
      kind: "restart",
      explanation: "That lesson no longer exists. Your attempts and completion credits are preserved.",
    };
  if (lesson.revision !== checkpoint.revision)
    return {
      kind: "restart",
      explanation: `That lesson changed (revision ${checkpoint.revision} → ${lesson.revision}). This lesson restarts; your attempts and completion credits are preserved.`,
    };
  const steps = new Map<string, Step>(lesson.steps.map((s) => [s.id, s]));
  if (!steps.has(checkpoint.stepId))
    return {
      kind: "restart",
      explanation: "That step no longer exists. This lesson restarts; your attempts and completion credits are preserved.",
    };
  // Rebuild the visited trail along the recorded branches.
  const trail: string[] = [];
  let current: string | null = lesson.entryStepId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    trail.push(current);
    if (current === checkpoint.stepId) break;
    const step: Step = steps.get(current)!;
    const branchKeys = Object.keys(step.branches ?? {});
    current =
      branchKeys.length > 0
        ? (step.branches![checkpoint.selectedBranches[current] ?? ""] ?? null)
        : step.nextStepId;
  }
  if (trail[trail.length - 1] !== checkpoint.stepId)
    return {
      kind: "restart",
      explanation: "That path through the lesson changed. This lesson restarts; your attempts and completion credits are preserved.",
    };
  const completedStepIds = mergeLearningEvents(events)
    .filter((e): e is StepCompletion => {
      const candidate = e as Partial<StepCompletion> & { type?: unknown };
      return (
        e.packId === pack.id &&
        candidate.type === "step-completed" &&
        candidate.lessonId === lesson.id &&
        candidate.lessonRevision === lesson.revision
      );
    })
    .map((e) => e.stepId);
  const fresh = startLesson(pack, lesson.id);
  return {
    kind: "resume",
    session: {
      ...fresh,
      activeStepId: checkpoint.stepId,
      visitedStepIds: trail,
      selectedBranches: { ...checkpoint.selectedBranches },
      accumulatedAssistance: [...checkpoint.assistance] as Assistance[],
      draftResponse: checkpoint.draft as LessonSession["draftResponse"],
      completedStepIds: [...new Set(completedStepIds)],
    },
  };
}
