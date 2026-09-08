import type { Exercise } from "./schema";
import { validatePack } from "./schema";
import type { AuthoredV2Activity, AuthoredV2Pack } from "./schema-v2";
import { validateV2Pack } from "./schema-v2";
import type {
  Activity,
  InformationActivity,
  LegacyActivity,
  MediaAsset,
  RuntimeLesson,
  RuntimePack,
  Skill,
  Stimulus,
} from "./lesson-runtime";

/**
 * Explicit version dispatch + v1 adapter (plan Task 2). `normalizePack` is
 * the single load boundary: every caller gets a `RuntimePack` regardless of
 * the authored schema version. v1 behavior is preserved byte-for-byte at the
 * exercise-identity level so progress replay keeps working.
 */

export function normalizePack(raw: unknown): RuntimePack {
  const version = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version === 1) return adaptV1(validatePack(raw));
  if (version === 2) return adaptV2(validateV2Pack(raw));
  throw new Error(
    `Unsupported course pack schemaVersion: ${JSON.stringify(version)}`,
  );
}

// ---------------------------------------------------------------- v1 adapter

const productionSkills = (exercise: Exercise): Skill[] =>
  exercise.kind === "dictation"
    ? ["listening"]
    : exercise.kind === "reading" ||
        exercise.kind === "choice" ||
        (exercise.kind === "translate" && exercise.mode === "recognition")
      ? ["reading", "vocabulary"]
      : ["writing", "grammar"];

const legacyAssistance = (
  exercise: Exercise,
): LegacyActivity["assistanceAffectsEvidence"] =>
  exercise.kind === "dictation"
    ? ["transcript", "model"]
    : exercise.mode === "production"
      ? ["hint", "model"]
      : ["translation", "model"];

function adaptV1(
  pack: ReturnType<typeof validatePack>,
): RuntimePack {
  const exercisesById: Record<string, Exercise> = {};
  const activities: Record<string, Activity> = {};
  const stimuli: Record<string, Stimulus> = {};
  const lessons: RuntimeLesson[] = pack.lessons.map((lesson) => {
    const required = lesson.exercises.filter(
      (e) => !lesson.optionalExerciseIds.includes(e.id),
    );
    const infoId = `${lesson.id}-intro`;
    const examplesId = `${lesson.id}-examples`;
    stimuli[examplesId] = {
      kind: "examples",
      id: examplesId,
      pairs: lesson.examples.map((e) => ({
        target: e.target,
        meaning: e.meaning,
      })),
    };
    const info: InformationActivity = {
      kind: "information",
      id: infoId,
      revision: 1,
      body: lesson.explanation,
      stimulusId: examplesId,
    };
    activities[infoId] = info;
    for (const exercise of lesson.exercises) {
      exercisesById[exercise.id] = exercise;
      activities[exercise.id] = {
        kind: "legacy",
        id: exercise.id,
        revision: 1,
        conceptIds: [exercise.conceptId],
        vocabulary: [...exercise.vocabulary],
        skills: productionSkills(exercise),
        prompt: exercise.prompt,
        hints: [],
        feedback: exercise.explanation,
        evidenceKey: exercise.id,
        assistanceAffectsEvidence: legacyAssistance(exercise),
        exerciseId: exercise.id,
        exercise,
      };
    }
    const steps: RuntimeLesson["steps"] = [
      {
        id: `${lesson.id}-step-intro`,
        purpose: "notice",
        activityId: infoId,
        required: true,
        nextStepId:
          lesson.exercises.length > 0
            ? `${lesson.id}-step-${lesson.exercises[0].id}`
            : null,
      },
      ...lesson.exercises.map((exercise, i) => ({
        id: `${lesson.id}-step-${exercise.id}`,
        purpose: "practice" as const,
        activityId: exercise.id,
        required: !lesson.optionalExerciseIds.includes(exercise.id),
        nextStepId:
          i + 1 < lesson.exercises.length
            ? `${lesson.id}-step-${lesson.exercises[i + 1].id}`
            : null,
      })),
    ];
    return {
      id: lesson.id,
      unitId: lesson.unitId,
      title: lesson.title,
      objective: lesson.objective,
      family: "discovery" as const,
      revision: 1,
      estimatedMinutes: Math.max(3, lesson.exercises.length),
      entryStepId: `${lesson.id}-step-intro`,
      steps,
      completionPolicy: {
        kind: "legacy-success",
        exerciseIds: required.map((e) => e.id),
      },
      prerequisites: lesson.prerequisites.map((lessonId) => ({
        lessonId,
        requirement: { kind: "legacy-success" as const },
      })),
      conceptIds: [...lesson.conceptIds],
      vocabulary: [...lesson.vocabulary],
      legacyExercises: [...lesson.exercises],
    };
  });
  return {
    schemaVersion: 1,
    id: pack.id,
    version: pack.version,
    language: pack.language,
    status: pack.status,
    title: pack.title,
    sourceLanguage: pack.sourceLanguage,
    description: pack.description,
    attribution: pack.attribution,
    units: pack.units,
    concepts: pack.concepts,
    vocabulary: pack.vocabulary,
    media: pack.media.map((m) => ({ ...m, kind: "audio" as const })),
    lessons,
    activities,
    stimuli,
    exercisesById,
    dialogues: pack.dialogues,
  };
}

// ---------------------------------------------------------------- v2 checks

const MAX_PATHS = 5000;

function adaptV2(pack: AuthoredV2Pack): RuntimePack {
  const fail = (message: string): never => {
    throw new Error(`${pack.id}: ${message}`);
  };
  /** Fetch-or-throw: `throw` narrows where the `fail` closure cannot. */
  const need = <T>(value: T | undefined, message: string): T => {
    if (value === undefined) throw new Error(`${pack.id}: ${message}`);
    return value;
  };
  if (pack.status === "coming-soon") {
    const present: Array<[string, unknown[]]> = [
      ["unit", pack.units],
      ["concept", pack.concepts],
      ["vocabulary entry", pack.vocabulary],
      ["audio clip", pack.media],
      ["stimulus", pack.stimuli],
      ["activity", pack.activities],
      ["lesson", pack.lessons],
      ["dialogue", pack.dialogues],
    ];
    for (const [label, values] of present)
      if (values.length) fail(`coming-soon pack must not ship ${label}s`);
  }
  if (!pack.units.length || !pack.concepts.length || !pack.lessons.length)
    fail("active pack needs units, concepts and lessons");

  const unique = (values: string[], label: string): Set<string> => {
    const seen = new Set(values);
    if (seen.size !== values.length) fail(`duplicate ${label}`);
    return seen;
  };
  const units = unique(pack.units.map((u) => u.id), "unit");
  const concepts = unique(pack.concepts.map((c) => c.id), "concept");
  const vocabulary = unique(pack.vocabulary.map((v) => v.id), "vocabulary");
  const mediaIds = unique(pack.media.map((m) => m.id), "media");
  const stimulusIds = unique(pack.stimuli.map((s) => s.id), "stimulus");
  const activityIds = unique(pack.activities.map((a) => a.id), "activity");
  const lessonIds = unique(pack.lessons.map((l) => l.id), "lesson");
  const conceptRefs = (values: string[], where: string) => {
    for (const c of values) if (!concepts.has(c)) fail(`unknown concept ${c} in ${where}`);
  };
  const vocabRefs = (values: string[], where: string) => {
    for (const v of values) if (!vocabulary.has(v)) fail(`unknown vocabulary ${v} in ${where}`);
  };

  const mediaById = new Map(pack.media.map((m) => [m.id, m]));
  const usedMedia = new Set<string>();
  const useMedia = (mediaId: string, kind: "audio" | "image", where: string) => {
    const asset = need(mediaById.get(mediaId), `unknown media ${mediaId} in ${where}`);
    if (asset.kind !== kind)
      fail(`media ${mediaId} in ${where} is ${asset.kind}, expected ${kind}`);
    usedMedia.add(mediaId);
  };
  for (const stimulus of pack.stimuli) {
    if (stimulus.kind === "audio") useMedia(stimulus.mediaId, "audio", `stimulus ${stimulus.id}`);
    if (stimulus.kind === "scene") {
      useMedia(stimulus.mediaId, "image", `stimulus ${stimulus.id}`);
      unique(stimulus.regions.map((r) => r.id), `scene region in ${stimulus.id}`);
      for (const r of stimulus.regions) {
        if (
          !Number.isFinite(r.x) || !Number.isFinite(r.y) ||
          !Number.isFinite(r.width) || !Number.isFinite(r.height) ||
          r.x + r.width > 1 || r.y + r.height > 1
        )
          fail(`scene region ${r.id} outside [0,1] bounds in ${stimulus.id}`);
      }
    }
    if (stimulus.kind === "dialogue")
      for (const turn of stimulus.turns)
        if (turn.mediaId) useMedia(turn.mediaId, "audio", `stimulus ${stimulus.id}`);
  }

  const activitiesById = new Map(pack.activities.map((a) => [a.id, a]));
  const stimuliById = new Map(pack.stimuli.map((s) => [s.id, s]));
  const usedStimuli = new Set<string>();
  const useStimulus = (stimulusId: string, where: string) => {
    if (!stimuliById.has(stimulusId)) fail(`unknown stimulus ${stimulusId} in ${where}`);
    usedStimuli.add(stimulusId);
  };

  // Legacy exercise identities: retained per lesson, unique globally so old
  // progress replays against the same IDs.
  const legacyById = new Map<string, Exercise>();
  for (const lesson of pack.lessons)
    for (const exercise of lesson.legacyExercises) {
      if (legacyById.has(exercise.id)) fail(`duplicate legacy exercise ${exercise.id}`);
      legacyById.set(exercise.id, exercise);
      if (exercise.kind === "dictation") {
        if (!mediaIds.has(exercise.audioId))
          fail(`missing audio ${exercise.audioId} in legacy ${exercise.id}`);
        usedMedia.add(exercise.audioId);
      }
    }

  const checkActivity = (activity: AuthoredV2Activity) => {
    const where = `activity ${activity.id}`;
    if (activity.kind !== "information" && activity.kind !== "self-compare") {
      conceptRefs(activity.conceptIds, where);
      vocabRefs(activity.vocabulary, where);
      if (!activity.assistanceAffectsEvidence.includes("model"))
        fail(`model reveal must affect evidence in ${where}`);
      if (activity.stimulusId) useStimulus(activity.stimulusId, where);
    } else if (activity.kind === "self-compare") {
      conceptRefs(activity.conceptIds, where);
      vocabRefs(activity.vocabulary, where);
      if (activity.stimulusId) useStimulus(activity.stimulusId, where);
      if (activity.modelAudioId)
        useMedia(activity.modelAudioId, "audio", where);
    } else if (activity.stimulusId) {
      useStimulus(activity.stimulusId, where);
    }
    switch (activity.kind) {
      case "legacy":
        if (!legacyById.has(activity.exerciseId))
          fail(`unknown legacy exercise ${activity.exerciseId} in ${where}`);
        break;
      case "selection": {
        const options = unique(activity.options.map((o) => o.id), `selection option in ${activity.id}`);
        for (const accepted of activity.acceptedIds)
          if (!options.has(accepted)) fail(`unknown accepted option ${accepted} in ${where}`);
        if (!activity.multiple && activity.acceptedIds.length !== 1)
          fail(`single-select ${where} needs exactly one accepted option`);
        break;
      }
      case "ordering": {
        const tokens = activity.tokens.map((t) => t.id);
        unique(tokens, `ordering token in ${activity.id}`);
        const tokenSet = new Set(tokens);
        for (const order of activity.acceptedOrders) {
          if (order.length !== tokens.length || !order.every((t) => tokenSet.has(t)))
            fail(`accepted order is not a permutation of tokens in ${where}`);
          if (new Set(order).size !== order.length)
            fail(`accepted order reuses a token in ${where}`);
        }
        break;
      }
      case "matching": {
        const left = unique(activity.left.map((o) => o.id), `matching left in ${activity.id}`);
        const right = unique(activity.right.map((o) => o.id), `matching right in ${activity.id}`);
        const seen = new Set<string>();
        for (const pair of activity.acceptedPairs) {
          if (!left.has(pair.leftId) || !right.has(pair.rightId))
            fail(`unknown matching pair ${pair.leftId}/${pair.rightId} in ${where}`);
          const key = `${pair.leftId}|${pair.rightId}`;
          if (seen.has(key)) fail(`duplicate matching pair in ${where}`);
          seen.add(key);
        }
        break;
      }
      case "cloze": {
        const blanks = new Set<string>();
        for (const segment of activity.segments)
          if (segment.kind === "blank") {
            if (blanks.has(segment.name)) fail(`duplicate blank ${segment.name} in ${where}`);
            blanks.add(segment.name);
          }
        const keys = new Set(Object.keys(activity.blanks));
        if (blanks.size !== keys.size || [...blanks].some((b) => !keys.has(b)))
          fail(`blank/answer mismatch in ${where}`);
        break;
      }
      case "dialogue-choice": {
        const options = unique(activity.options.map((o) => o.id), `dialogue option in ${activity.id}`);
        for (const accepted of activity.acceptedIds)
          if (!options.has(accepted)) fail(`unknown accepted reply ${accepted} in ${where}`);
        break;
      }
      case "scene-selection": {
        const stimulus = need(
          stimuliById.get(activity.stimulusId),
          `unknown stimulus ${activity.stimulusId} in ${where}`,
        );
        if (stimulus.kind !== "scene")
          throw new Error(`${pack.id}: scene-selection ${where} needs a scene stimulus`);
        const regions = new Set(stimulus.regions.map((r) => r.id));
        for (const region of activity.acceptedRegionIds)
          if (!regions.has(region)) fail(`unknown scene region ${region} in ${where}`);
        break;
      }
      case "information":
      case "self-compare":
      case "text":
        break;
    }
  };
  for (const activity of pack.activities) checkActivity(activity);

  const usedActivities = new Set<string>();
  const runtimeActivities: Record<string, Activity> = {};
  for (const activity of pack.activities) {
    if (activity.kind === "legacy") {
      const exercise = need(
        legacyById.get(activity.exerciseId),
        `unknown legacy exercise ${activity.exerciseId}`,
      );
      runtimeActivities[activity.id] = {
        ...activity,
        skills: [...activity.skills],
        conceptIds: [...activity.conceptIds],
        vocabulary: [...activity.vocabulary],
        hints: [...activity.hints],
        assistanceAffectsEvidence: [...activity.assistanceAffectsEvidence],
        exercise,
      };
    } else {
      runtimeActivities[activity.id] = activity;
    }
  }

  const runtimeLessons: RuntimeLesson[] = pack.lessons.map((lesson) => {
    const where = `lesson ${lesson.id}`;
    if (!units.has(lesson.unitId)) fail(`unknown unit in ${where}`);
    conceptRefs(lesson.conceptIds, where);
    vocabRefs(lesson.vocabulary, where);
    for (const prerequisite of lesson.prerequisites) {
      if (!lessonIds.has(prerequisite.lessonId))
        fail(`unknown prerequisite ${prerequisite.lessonId} in ${where}`);
      if (prerequisite.lessonId === lesson.id)
        fail(`self prerequisite in ${where}`);
    }
    const steps = new Map(lesson.steps.map((s) => [s.id, s]));
    unique(lesson.steps.map((s) => s.id), `step in ${where}`);
    if (!steps.has(lesson.entryStepId)) fail(`unknown entry step in ${where}`);
    for (const step of lesson.steps) {
      const activity = need(
        activitiesById.get(step.activityId),
        `unknown activity ${step.activityId} in step ${step.id}`,
      );
      usedActivities.add(step.activityId);
      if (step.supportActivityId) {
        if (!activitiesById.has(step.supportActivityId))
          fail(`unknown support activity in step ${step.id}`);
        usedActivities.add(step.supportActivityId);
      }
      if (step.nextStepId && !steps.has(step.nextStepId))
        fail(`unknown next step ${step.nextStepId} in step ${step.id}`);
      const branchTargets = Object.values(step.branches);
      for (const target of branchTargets)
        if (!steps.has(target)) fail(`unknown branch target ${target} in step ${step.id}`);
      if (branchTargets.length > 0) {
        if (activity.kind !== "dialogue-choice")
          throw new Error(`${pack.id}: branches only allowed on dialogue choices in step ${step.id}`);
        const options = new Set(activity.options.map((o) => o.id));
        for (const key of Object.keys(step.branches))
          if (!options.has(key)) fail(`branch ${key} is not a reply option in step ${step.id}`);
      }
    }
    // Support activities rejoin their step; they are never path activities.
    for (const step of lesson.steps) {
      if (
        step.supportActivityId &&
        lesson.steps.some((s) => s.activityId === step.supportActivityId)
      )
        fail(`support activity doubles as a path activity in step ${step.id}`);
    }
    // Reachability + cycle check from the entry step.
    const visited = new Set<string>();
    const visiting: string[] = [];
    const visit = (stepId: string) => {
      if (visiting.includes(stepId)) fail(`step graph cycle at ${stepId} in ${where}`);
      if (visited.has(stepId)) return;
      visiting.push(stepId);
      visited.add(stepId);
      const step = need(steps.get(stepId), `unknown step ${stepId} in ${where}`);
      if (step.nextStepId) visit(step.nextStepId);
      for (const target of Object.values(step.branches)) visit(target);
      visiting.pop();
    };
    visit(lesson.entryStepId);
    if (visited.size !== steps.size) fail(`unreachable step in ${where}`);
    const terminals = lesson.steps.filter(
      (s) => !s.nextStepId && Object.keys(s.branches).length === 0,
    );
    if (!terminals.length) fail(`no terminal step in ${where}`);
    // Every permitted terminal path must satisfy the completion policy.
    const paths: string[][] = [];
    const walk = (stepId: string, trail: string[]) => {
      if (paths.length >= MAX_PATHS) fail(`step graph too complex in ${where}`);
      const step = need(steps.get(stepId), `unknown step ${stepId} in ${where}`);
      const next = [...trail, stepId];
      const successors = [
        ...(step.nextStepId ? [step.nextStepId] : []),
        ...Object.values(step.branches),
      ];
      if (!successors.length) {
        paths.push(next);
        return;
      }
      for (const successor of successors) {
        if (next.includes(successor)) fail(`step graph cycle at ${successor} in ${where}`);
        walk(successor, next);
      }
    };
    walk(lesson.entryStepId, []);
    if (lesson.completionPolicy.kind === "evidence") {
      for (const path of paths) {
        const produced = new Set<string>();
        for (const stepId of path) {
          const step = need(steps.get(stepId), `unknown step ${stepId} in ${where}`);
          if (!step.required) continue;
          const activity = need(
            activitiesById.get(step.activityId),
            `unknown activity ${step.activityId} in ${where}`,
          );
          if (
            activity.kind !== "information" &&
            activity.kind !== "self-compare"
          )
            produced.add(activity.evidenceKey);
        }
        for (const target of lesson.completionPolicy.targets)
          if (!produced.has(target.evidenceKey))
            fail(`evidence ${target.evidenceKey} unreachable on a terminal path in ${where}`);
      }
    }
    return {
      id: lesson.id,
      unitId: lesson.unitId,
      title: lesson.title,
      objective: lesson.objective,
      family: lesson.family,
      revision: lesson.revision,
      estimatedMinutes: lesson.estimatedMinutes,
      entryStepId: lesson.entryStepId,
      steps: lesson.steps.map((s) => ({ ...s, branches: { ...s.branches } })),
      completionPolicy: lesson.completionPolicy,
      prerequisites: lesson.prerequisites.map((p) => ({ ...p })),
      conceptIds: [...lesson.conceptIds],
      vocabulary: [...lesson.vocabulary],
      legacyExercises: lesson.legacyExercises.map((e) => ({ ...e })),
    };
  });

  for (const activity of pack.activities)
    if (!usedActivities.has(activity.id))
      fail(`orphaned activity ${activity.id}`);
  for (const stimulus of pack.stimuli)
    if (!usedStimuli.has(stimulus.id))
      fail(`orphaned stimulus ${stimulus.id}`);
  for (const id of mediaIds)
    if (!usedMedia.has(id)) fail(`orphaned media ${id}`);

  const exercisesById: Record<string, Exercise> = {};
  for (const [exerciseId, exercise] of legacyById) exercisesById[exerciseId] = exercise;

  const media: MediaAsset[] = pack.media.map((m) =>
    m.kind === "audio"
      ? {
          id: m.id,
          kind: "audio" as const,
          url: m.url,
          sha256: m.sha256,
          attribution: m.attribution,
          transcript: m.transcript,
        }
      : {
          id: m.id,
          kind: "image" as const,
          url: m.url,
          sha256: m.sha256,
          attribution: m.attribution,
        },
  );

  return {
    schemaVersion: 2,
    id: pack.id,
    version: pack.version,
    language: pack.language,
    status: pack.status,
    title: pack.title,
    sourceLanguage: pack.sourceLanguage,
    description: pack.description,
    attribution: pack.attribution,
    units: pack.units,
    concepts: pack.concepts,
    vocabulary: pack.vocabulary,
    media,
    lessons: runtimeLessons,
    activities: runtimeActivities,
    stimuli: Object.fromEntries(pack.stimuli.map((s) => [s.id, s])),
    exercisesById,
    dialogues: pack.dialogues,
  };
}

export { validateV2Pack };
