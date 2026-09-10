import { evaluateActivity } from "./activity-evaluation";
import type {
  Assistance,
  Evaluation,
  Response,
  RuntimeLesson,
  RuntimePack,
} from "./lesson-runtime";

/**
 * Deterministic lesson session engine (plan Task 3). Pure reducers: no
 * storage, clocks, or random ID generation. The caller persists events
 * between `submitResponse` and `advanceLesson` — advancing never writes.
 */

export type LessonSession = {
  lessonId: string;
  revision: number;
  activeStepId: string;
  visitedStepIds: string[];
  selectedBranches: Record<string, string>;
  /** Support overlay: help activity shown over the current step. */
  activeSupportActivityId: string | null;
  draftResponse: Response | null;
  accumulatedAssistance: Assistance[];
  currentEvaluation: Evaluation | null;
  completedStepIds: string[];
  status: "active" | "complete";
};

const lessonOf = (pack: RuntimePack, lessonId: string): RuntimeLesson => {
  const lesson = pack.lessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson ${lessonId} in ${pack.id}`);
  return lesson;
};

const checkedLesson = (pack: RuntimePack, state: LessonSession): RuntimeLesson => {
  const lesson = lessonOf(pack, state.lessonId);
  if (lesson.revision !== state.revision)
    throw new Error(
      `Lesson ${state.lessonId} changed (r${state.revision} → r${lesson.revision}); restart the session`,
    );
  if (state.status !== "active") throw new Error(`Lesson ${state.lessonId} is complete`);
  return lesson;
};

export function startLesson(pack: RuntimePack, lessonId: string): LessonSession {
  const lesson = lessonOf(pack, lessonId);
  return {
    lessonId,
    revision: lesson.revision,
    activeStepId: lesson.entryStepId,
    visitedStepIds: [lesson.entryStepId],
    selectedBranches: {},
    activeSupportActivityId: null,
    draftResponse: null,
    accumulatedAssistance: [],
    currentEvaluation: null,
    completedStepIds: [],
    status: "active",
  };
}

/** Show the active step's support activity; submission returns to the step. */
export function openSupport(pack: RuntimePack, state: LessonSession): LessonSession {
  const lesson = checkedLesson(pack, state);
  const step = lesson.steps.find((s) => s.id === state.activeStepId);
  if (!step?.supportActivityId)
    throw new Error(`Step ${state.activeStepId} has no support activity`);
  return { ...state, activeSupportActivityId: step.supportActivityId,
    accumulatedAssistance: [...new Set([...state.accumulatedAssistance, "hint" as const])] };
}

export function submitResponse(
  pack: RuntimePack,
  state: LessonSession,
  response: Response,
  assistance: Assistance[],
): LessonSession {
  const lesson = checkedLesson(pack, state);
  const step = lesson.steps.find((s) => s.id === state.activeStepId);
  if (!step) throw new Error(`Unknown step ${state.activeStepId}`);
  const activityId = state.activeSupportActivityId ?? step.activityId;
  const activity = pack.activities[activityId];
  if (!activity) throw new Error(`Unknown activity ${activityId}`);

  const merged = [...new Set([...state.accumulatedAssistance, ...assistance])];
  const evaluation = evaluateActivity(activity, response, merged);

  // Support submissions never complete the step; they return to it with the
  // assistance carried into retries.
  if (state.activeSupportActivityId) {
    return {
      ...state,
      activeSupportActivityId: null,
      accumulatedAssistance: merged,
      currentEvaluation: null,
    };
  }

  const completed =
    evaluation.outcome === "correct" ||
    evaluation.outcome === "ungraded" ||
    evaluation.outcome === "self-assessed";
  const completedStepIds = completed
    ? [...new Set([...state.completedStepIds, step.id])]
    : state.completedStepIds.filter((id) => id !== step.id);

  // Record the chosen branch once a dialogue reply is submitted; the step
  // completes only on an accepted reply, so the recorded branch is valid.
  let selectedBranches = state.selectedBranches;
  if (
    completed &&
    response.kind === "selection" &&
    Object.keys(step.branches ?? {}).length > 0 &&
    response.ids.length === 1 &&
    step.branches![response.ids[0]] !== undefined
  ) {
    selectedBranches = { ...state.selectedBranches, [step.id]: response.ids[0] };
  }

  return {
    ...state,
    selectedBranches,
    draftResponse: response,
    accumulatedAssistance: merged,
    currentEvaluation: evaluation,
    completedStepIds,
  };
}

export function advanceLesson(
  pack: RuntimePack,
  state: LessonSession,
): LessonSession {
  const lesson = checkedLesson(pack, state);
  if (state.activeSupportActivityId)
    throw new Error("Resolve the support activity before advancing");
  if (!state.currentEvaluation)
    throw new Error(`Step ${state.activeStepId} has no evaluation yet`);
  if (!state.completedStepIds.includes(state.activeStepId))
    throw new Error(`Step ${state.activeStepId} is not complete`);
  const step = lesson.steps.find((s) => s.id === state.activeStepId)!;

  let next: string | null = step.nextStepId;
  const branchKeys = Object.keys(step.branches ?? {});
  if (branchKeys.length > 0) {
    const chosen = state.selectedBranches[step.id];
    if (!chosen || step.branches![chosen] === undefined)
      throw new Error(`Step ${step.id} needs a chosen branch`);
    next = step.branches![chosen];
  }
  if (!next) {
    return { ...state, status: "complete" };
  }
  return {
    ...state,
    activeStepId: next,
    // Shared reference reveals may remain visible; an earlier activity's
    // hint/model must not taint an unrelated independent transfer forever.
    accumulatedAssistance: state.accumulatedAssistance.filter(kind => kind === "translation" || kind === "transcript"),
    visitedStepIds: [...state.visitedStepIds, next],
    draftResponse: null,
    currentEvaluation: null,
  };
}
