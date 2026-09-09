import type { AnswerSpec, CoursePack, Exercise } from "./schema";

/**
 * Lesson variety runtime (plan §3). These are the normalized public shapes
 * every family renderer, the session engine, and persistence build on.
 * Authored JSON is validated in `schema-v2.ts`; both v1 and v2 packs are
 * normalized into these types in `normalize-pack.ts`.
 */

export type Family =
  | "discovery"
  | "story"
  | "conversation"
  | "listening"
  | "construction"
  | "scene"
  | "mission"
  | "recall";

export type Skill =
  | "reading"
  | "listening"
  | "writing"
  | "speaking"
  | "grammar"
  | "vocabulary";

export type Assistance = "hint" | "translation" | "transcript" | "model";

export type Response =
  | { kind: "text"; text: string }
  | { kind: "selection"; ids: string[] }
  | { kind: "ordering"; ids: string[] }
  | { kind: "matching"; pairs: Array<{ leftId: string; rightId: string }> }
  | { kind: "cloze"; values: Record<string, string> }
  | { kind: "self"; rating: "again" | "comfortable" }
  | { kind: "continue" };

export type Evaluation = {
  outcome: "correct" | "incorrect" | "self-assessed" | "ungraded" | "blocked";
  /** Independent evidence counts toward review/SRS only when true. */
  independent: boolean;
  feedback: string;
};

export type Step = {
  id: string;
  purpose: "notice" | "predict" | "explain" | "practice" | "transfer" | "reflect";
  activityId: string;
  required: boolean;
  nextStepId: string | null;
  /** Selected option ID -> successor step. Dialogue choices only. */
  branches?: Record<string, string>;
  /** Optional help activity; completion returns to this step. */
  supportActivityId?: string;
};

export type CompletionPolicy =
  | { kind: "legacy-success"; exerciseIds: string[] }
  | { kind: "participation" }
  | {
      kind: "evidence";
      targets: Array<{ evidenceKey: string; successes: number }>;
    };

export type PrerequisiteRequirement =
  | { kind: "participation" }
  | { kind: "evidence"; evidenceKey: string; successes: number }
  | { kind: "legacy-success" };

export type TextStimulus = {
  kind: "text";
  id: string;
  body: string;
  translation?: string;
};

export type ExamplesStimulus = {
  kind: "examples";
  id: string;
  pairs: Array<{ target: string; meaning: string }>;
};

export type AudioStimulus = {
  kind: "audio";
  id: string;
  mediaId: string;
};

export type DialogueStimulus = {
  kind: "dialogue";
  id: string;
  turns: Array<{
    speaker: string;
    text: string;
    meaning?: string;
    mediaId?: string;
  }>;
};

export type SceneStimulus = {
  kind: "scene";
  id: string;
  mediaId: string;
  alt: string;
  regions: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  textAlternative: string;
};

export type Stimulus =
  | TextStimulus
  | ExamplesStimulus
  | AudioStimulus
  | DialogueStimulus
  | SceneStimulus;

export type MediaAsset = {
  id: string;
  kind: "audio" | "image";
  url: string;
  sha256: string;
  attribution: string;
  /** Required for audio assets. */
  transcript?: string;
};

type GradedBase = {
  id: string;
  revision: number;
  conceptIds: string[];
  vocabulary: string[];
  skills: Skill[];
  stimulusId?: string;
  prompt: string;
  hints: string[];
  feedback: string;
  evidenceKey: string;
  /**
   * Assistance kinds that taint the attempt. `model` is always included on
   * graded activities; authors can never mark a model reveal as independent.
   */
  assistanceAffectsEvidence: Assistance[];
};

export type LegacyActivity = GradedBase & {
  kind: "legacy";
  exerciseId: string;
  /** Normalized embedded exercise so the evaluator needs no pack lookup. */
  exercise: Exercise;
};

export type InformationActivity = {
  kind: "information";
  id: string;
  revision: number;
  body: string;
  stimulusId?: string;
};

export type TextActivity = GradedBase & {
  kind: "text";
  answer: AnswerSpec;
};

export type SelectionActivity = GradedBase & {
  kind: "selection";
  options: Array<{ id: string; text: string }>;
  acceptedIds: string[];
  multiple: boolean;
};

export type OrderingActivity = GradedBase & {
  kind: "ordering";
  tokens: Array<{ id: string; text: string }>;
  acceptedOrders: string[][];
};

export type MatchingActivity = GradedBase & {
  kind: "matching";
  left: Array<{ id: string; text: string }>;
  right: Array<{ id: string; text: string }>;
  acceptedPairs: Array<{ leftId: string; rightId: string }>;
};

export type ClozeActivity = GradedBase & {
  kind: "cloze";
  segments: Array<
    | { kind: "text"; text: string }
    | { kind: "blank"; name: string; label: string }
  >;
  blanks: Record<string, AnswerSpec>;
};

export type DialogueChoiceActivity = GradedBase & {
  kind: "dialogue-choice";
  options: Array<{ id: string; text: string; feedback: string }>;
  acceptedIds: string[];
};

export type SceneSelectionActivity = GradedBase & {
  kind: "scene-selection";
  stimulusId: string;
  acceptedRegionIds: string[];
};

export type SelfCompareActivity = {
  kind: "self-compare";
  id: string;
  revision: number;
  conceptIds: string[];
  vocabulary: string[];
  skills: Skill[];
  stimulusId?: string;
  prompt: string;
  modelText: string;
  modelAudioId?: string;
};

export type Activity =
  | LegacyActivity
  | InformationActivity
  | TextActivity
  | SelectionActivity
  | OrderingActivity
  | MatchingActivity
  | ClozeActivity
  | DialogueChoiceActivity
  | SceneSelectionActivity
  | SelfCompareActivity;

export type RuntimeLesson = {
  id: string;
  unitId: string;
  title: string;
  objective: string;
  family: Family;
  revision: number;
  estimatedMinutes: number;
  entryStepId: string;
  steps: Step[];
  completionPolicy: CompletionPolicy;
  prerequisites: Array<{ lessonId: string; requirement: PrerequisiteRequirement }>;
  conceptIds: string[];
  vocabulary: string[];
  /** Retained v1 exercise collection (also embedded per legacy activity). */
  legacyExercises: Exercise[];
  /** Required v1 IDs retained independently of the new completion policy. */
  legacyCompletionExerciseIds: string[];
};

export type RuntimePack = {
  schemaVersion: 1 | 2;
  id: string;
  version: string;
  language: CoursePack["language"];
  status: CoursePack["status"];
  title: string;
  sourceLanguage: "en";
  description: string;
  attribution: string;
  units: CoursePack["units"];
  concepts: CoursePack["concepts"];
  vocabulary: CoursePack["vocabulary"];
  media: MediaAsset[];
  lessons: RuntimeLesson[];
  activities: Record<string, Activity>;
  stimuli: Record<string, Stimulus>;
  /** Stable v1 exercise identities, preserved for progress replay. */
  exercisesById: Record<string, Exercise>;
  dialogues: CoursePack["dialogues"];
};

/** Activities that can produce independent review evidence. */
export function isGradedActivity(
  activity: Activity,
): activity is Exclude<Activity, InformationActivity | SelfCompareActivity> {
  return (
    activity.kind !== "information" && activity.kind !== "self-compare"
  );
}
