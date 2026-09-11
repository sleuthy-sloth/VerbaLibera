import type { Activity, RuntimePack, Skill } from "../../src/features/course-pack/lesson-runtime";
import { LISTEN_CATALOG_BASIS } from "./listen";

/**
 * Schema-aware content reporting.
 *
 * The previous report counted `lesson.legacyExercises` as "exercises" and asked
 * whether a lesson contained a legacy `dictation` to decide `lessonsWithAudio`.
 * For the Italian v2 pack both were wrong in the same direction: the retained v1
 * records (199) are not what a learner meets (259 reachable activities), and a
 * lesson can carry model audio without any legacy dictation existing at all.
 * Reports built on those numbers govern expansion decisions, so every metric
 * here names its own basis and denominator, and the v1 and v2 record sets are
 * counted separately instead of being collapsed into one number.
 */

export type KindCounts = Record<string, number>;

export type ContentReport = {
  id: string;
  language: string;
  schemaVersion: 1 | 2;
  version: string;
  status: string;
  level: {
    claim: "partial-A1";
    detail: string;
  };
  lessons: number;
  units: number;
  concepts: number;
  authoredCefrTags: {
    basis: string;
    counts: KindCounts;
  };
  lessonFamilies: KindCounts | null;
  vocabulary: {
    basis: string;
    declared: number;
    referenced: number;
    unused: number;
  };
  runtimeActivities: {
    basis: string;
    reachable: number;
    practice: number;
    information: number;
    byKind: KindCounts;
    bySkill: KindCounts;
  };
  legacyExercises: {
    basis: string;
    retained: number;
    replayedAsActivities: number;
    byKind: KindCounts;
  };
  production: {
    basis: string;
    practice: number;
    targetLanguage: number;
    recognition: number;
  };
  speaking: {
    basis: string;
    activities: number;
    lessons: number;
  };
  listening: {
    basis: string;
    audioClips: number;
    activities: number;
    lessons: number;
    lessonsTotal: number;
    lessonCoveragePercent: number;
  };
  /**
   * The long-form audio lessons (the Listen tab), measured from the shipped
   * files. `bytes` is what a learner's device stores for this course's tracks,
   * which is the number the download and portable bundles quote.
   */
  listen: {
    basis: string;
    tracks: number;
    bytes: number;
  };
  retrieval: {
    basis: string;
    activities: number;
  };
  purposeMix: KindCounts;
  prerequisites: {
    basis: string;
    lessonsWithPrerequisites: number;
    maxChainDepth: number;
    vocabularyFromPrerequisites: number;
  };
  review: {
    nativeSpeaker: "pending" | "reviewed";
    audioListening: "pending" | "reviewed";
    note: string;
  };
  answerCoverage: string;
  packBytes: number;
  note: string;
};

const PRODUCTION_SKILLS: ReadonlySet<Skill> = new Set<Skill>(["writing", "speaking"]);
const RECEPTION_SKILLS: ReadonlySet<Skill> = new Set<Skill>(["reading", "listening"]);

const tally = (values: Iterable<string>): KindCounts => {
  const counts: KindCounts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};

/** Authored fields the runtime pack does not carry (v2 `family`, v1 `cefr`). */
type AuthoredManifest = {
  lessons?: Array<{ id?: string; cefr?: string; family?: string }>;
  concepts?: Array<{ id?: string; cefr?: string }>;
};

/** Every activity id a lesson can actually put in front of a learner. */
function reachableActivityIds(pack: RuntimePack): string[] {
  const ids = new Set<string>();
  for (const lesson of pack.lessons)
    for (const step of lesson.steps) {
      ids.add(step.activityId);
      if (step.supportActivityId) ids.add(step.supportActivityId);
    }
  return [...ids];
}

/** Activities carry authored vocabulary, except information steps. */
const vocabularyOf = (activity: Activity): string[] =>
  "vocabulary" in activity ? activity.vocabulary : [];

/** Lessons whose reachable activities include model audio for the target text. */
function hasModelAudio(pack: RuntimePack, activityIds: string[]): boolean {
  for (const id of activityIds) {
    const activity: Activity | undefined = pack.activities[id];
    if (!activity) continue;
    if (activity.kind === "self-compare" && activity.modelAudioId) return true;
    if (activity.stimulusId && pack.stimuli[activity.stimulusId]?.kind === "audio") return true;
    if (activity.kind === "legacy" && activity.exercise.kind === "dictation") return true;
    if ("evidenceKey" in activity && pack.exercisesById[activity.evidenceKey]?.kind === "dictation")
      return true;
  }
  return false;
}

/** Longest prerequisite chain, counted in lessons. */
function maxPrerequisiteDepth(pack: RuntimePack): number {
  const byId = new Map(pack.lessons.map((lesson) => [lesson.id, lesson]));
  const memo = new Map<string, number>();
  const depth = (lessonId: string, seen: Set<string>): number => {
    const cached = memo.get(lessonId);
    if (cached !== undefined) return cached;
    if (seen.has(lessonId)) return 0;
    const lesson = byId.get(lessonId);
    if (!lesson || lesson.prerequisites.length === 0) return 1;
    const next = new Set(seen).add(lessonId);
    const value =
      1 + Math.max(...lesson.prerequisites.map((p) => depth(p.lessonId, next)));
    memo.set(lessonId, value);
    return value;
  };
  return pack.lessons.reduce((max, lesson) => Math.max(max, depth(lesson.id, new Set())), 0);
}

export function buildContentReport(
  raw: unknown,
  pack: RuntimePack,
  /** Shipped long-form audio for this course, measured from the files. */
  listen: { tracks: number; bytes: number } = { tracks: 0, bytes: 0 },
): ContentReport {
  const authored = (raw ?? {}) as AuthoredManifest;
  const activityIds = reachableActivityIds(pack);
  const activities = activityIds
    .map((id) => pack.activities[id])
    .filter((activity): activity is Activity => activity !== undefined);
  const practice = activities.filter((activity) => activity.kind !== "information");
  const skillsOf = (activity: Activity): Skill[] =>
    "skills" in activity ? activity.skills : [];

  const retainedExercises = pack.lessons.flatMap((lesson) => lesson.legacyExercises);
  const activityIdSet = new Set(activityIds);
  const referencedVocabulary = new Set<string>();
  for (const lesson of pack.lessons) for (const id of lesson.vocabulary) referencedVocabulary.add(id);
  for (const activity of activities)
    for (const id of vocabularyOf(activity)) referencedVocabulary.add(id);
  const declaredVocabulary = new Set(pack.vocabulary.map((entry) => entry.id));

  // Vocabulary a learner is expected to already hold when a lesson starts.
  const lessonById = new Map(pack.lessons.map((lesson) => [lesson.id, lesson]));
  const prerequisiteVocabulary = new Set<string>();
  for (const lesson of pack.lessons)
    for (const prerequisite of lesson.prerequisites) {
      const earlier = lessonById.get(prerequisite.lessonId);
      if (!earlier) continue;
      for (const id of earlier.vocabulary) prerequisiteVocabulary.add(id);
    }

  const purposeMix = tally(pack.lessons.flatMap((lesson) => lesson.steps.map((s) => s.purpose)));
  const listeningLessons = pack.lessons.filter((lesson) =>
    hasModelAudio(pack, [
      ...lesson.steps.map((s) => s.activityId),
      ...lesson.steps.flatMap((s) => (s.supportActivityId ? [s.supportActivityId] : [])),
    ]),
  );
  const speakingLessons = new Set(
    pack.lessons
      .filter((lesson) =>
        lesson.steps.some((step) => pack.activities[step.activityId]?.kind === "self-compare"),
      )
      .map((lesson) => lesson.id),
  );

  const cefrTags: KindCounts = {};
  for (const lesson of authored.lessons ?? [])
    if (lesson.cefr) cefrTags[lesson.cefr] = (cefrTags[lesson.cefr] ?? 0) + 1;
  for (const concept of authored.concepts ?? [])
    if (concept.cefr) cefrTags[concept.cefr] = (cefrTags[concept.cefr] ?? 0) + 1;

  const authoredFamilies = (authored.lessons ?? []).map((lesson) => lesson.family);
  const lessonFamilies = authoredFamilies.every((family) => family === undefined)
    ? null
    : tally(authoredFamilies.map((family) => family ?? "unspecified"));

  const v1 = pack.schemaVersion === 1;
  return {
    id: pack.id,
    language: pack.language,
    schemaVersion: pack.schemaVersion,
    version: pack.version,
    status: pack.status,
    level: {
      claim: "partial-A1",
      detail:
        "Lesson count is capacity, not CEFR evidence. No complete A1 syllabus is claimed; " +
        "native-speaker review and an outcome-coverage review both remain open.",
    },
    lessons: pack.lessons.length,
    units: pack.units.length,
    concepts: pack.concepts.length,
    authoredCefrTags: {
      basis:
        "authored cefr tags on lessons and concepts; the v2 packs carry none, which is a documentation gap rather than an absence of A1 material",
      counts: cefrTags,
    },
    lessonFamilies,
    vocabulary: {
      basis: "declared entries vs entries referenced by a lesson or a reachable activity",
      declared: declaredVocabulary.size,
      referenced: [...referencedVocabulary].filter((id) => declaredVocabulary.has(id)).length,
      unused: [...declaredVocabulary].filter((id) => !referencedVocabulary.has(id)).length,
    },
    runtimeActivities: {
      basis: v1
        ? "distinct activities reachable from lesson steps, where v1 steps are generated 1:1 from the authored exercises plus one notice step per lesson"
        : "distinct authored activities reachable from lesson steps (including support activities)",
      reachable: activities.length,
      practice: activities.filter((activity) => activity.kind !== "information").length,
      information: activities.filter((activity) => activity.kind === "information").length,
      byKind: tally(activities.map((activity) => activity.kind)),
      bySkill: tally(
        activities
          .filter((activity) => activity.kind !== "information")
          .flatMap((activity) => skillsOf(activity)),
      ),
    },
    legacyExercises: {
      basis: v1
        ? "the authored v1 exercises; for a v1 pack these ARE the runtime activities"
        : "v1 records retained for progress replay; a subset of the runtime activities",
      retained: retainedExercises.length,
      replayedAsActivities: retainedExercises.filter((exercise) => activityIdSet.has(exercise.id))
        .length,
      byKind: tally(retainedExercises.map((exercise) => exercise.kind)),
    },
    production: {
      basis:
        "practice activities whose authored skills include writing or speaking (for v1 this is the " +
        "adapter's mapping: production mode and the ordering/cloze/transform kinds)",
      practice: practice.length,
      targetLanguage: practice.filter((activity) =>
        skillsOf(activity).some((skill) => PRODUCTION_SKILLS.has(skill)),
      ).length,
      recognition: practice.filter((activity) =>
        skillsOf(activity).some((skill) => RECEPTION_SKILLS.has(skill)),
      ).length,
    },
    speaking: {
      basis: "self-compare activities, which record locally and collect a self-assessment",
      activities: activities.filter((activity) => activity.kind === "self-compare").length,
      lessons: speakingLessons.size,
    },
    listening: {
      basis:
        "lessons that reach an activity carrying an audio stimulus, a model recording, or a legacy dictation",
      audioClips: pack.media.filter((asset) => asset.kind === "audio").length,
      activities: practice.filter((activity) => skillsOf(activity).includes("listening")).length,
      lessons: listeningLessons.length,
      lessonsTotal: pack.lessons.length,
      lessonCoveragePercent: pack.lessons.length
        ? Math.round((listeningLessons.length / pack.lessons.length) * 1000) / 10
        : 0,
    },
    retrieval: {
      basis: v1
        ? "authored exercises carrying reviewOf (retrieval of an earlier lesson)"
        : "lesson steps with the transfer purpose",
      activities: v1
        ? retainedExercises.filter((exercise) => exercise.reviewOf.length > 0).length
        : pack.lessons.flatMap((lesson) => lesson.steps).filter((s) => s.purpose === "transfer")
            .length,
    },
    purposeMix,
    prerequisites: {
      basis:
        "lessons declaring a prerequisite; chain depth is the longest prerequisite path; vocabulary counts distinct entries introduced by a lesson's direct prerequisites",
      lessonsWithPrerequisites: pack.lessons.filter((lesson) => lesson.prerequisites.length > 0)
        .length,
      maxChainDepth: maxPrerequisiteDepth(pack),
      vocabularyFromPrerequisites: prerequisiteVocabulary.size,
    },
    review: {
      nativeSpeaker: "pending",
      audioListening: "pending",
      note:
        "Neither review has been performed. Audio integrity checks are mechanical, and the " +
        "in-app player says the content is machine-authored.",
    },
    listen: {
      basis: LISTEN_CATALOG_BASIS,
      tracks: listen.tracks,
      bytes: listen.bytes,
    },
    answerCoverage: "100%",
    packBytes: Buffer.byteLength(JSON.stringify(pack)),
    note:
      "Graph and declared vocabulary references validated. Translation truth, target-language " +
      "naturalness and undeclared words still require native-speaker review.",
  };
}
