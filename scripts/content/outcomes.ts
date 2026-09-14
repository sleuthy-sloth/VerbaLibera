import type {
  Activity,
  RuntimeLesson,
  RuntimePack,
  Skill,
} from "../../src/features/course-pack/lesson-runtime";
import type { ProseReview } from "./review";

/**
 * The outcome matrix: what each lesson teaches, what it brings back, and what is
 * missing — projected from the packs, never hand-written.
 *
 * Roadmap §4A asks for a matrix per language (communicative objective,
 * prerequisites, introduced and retrieved vocabulary, grammatical pattern,
 * practice modes, review status) and for the gaps it exposes. Everything in that
 * list is already authored in `courses/<language>/manifest.json`, which is why
 * this is a projection rather than a second copy: a hand-kept table is what the
 * packs outgrow, and `docs/cefr-coverage.md` outgrew them within a day.
 *
 * Nothing here reads the clock, the filesystem or the network. Same packs in,
 * same bytes out — which is what lets `docs/curriculum-matrix.md` be checked in
 * and compared against this renderer instead of trusted.
 */

/** The four learner-facing practice modes the matrix reports. */
export type Mode = "recognition" | "production" | "listening" | "speaking";

export const MODES: readonly Mode[] = ["recognition", "production", "listening", "speaking"];

const MODE_BY_SKILL: Record<Skill, Mode[]> = {
  reading: ["recognition"],
  vocabulary: ["recognition"],
  writing: ["production"],
  grammar: ["production"],
  listening: ["listening"],
  speaking: ["speaking"],
};

/**
 * Modes for a kind that carries no authored `skills`.
 *
 * Only the kinds whose mode is unambiguous are listed. `text` is deliberately
 * absent: the same kind is a meaning question (recognition) or a written
 * production depending on its skills, and guessing would put a fiction in a
 * document whose whole purpose is to be checkable.
 */
const MODE_BY_KIND: Partial<Record<string, Mode[]>> = {
  selection: ["recognition"],
  matching: ["recognition"],
  "scene-selection": ["recognition"],
  "dialogue-choice": ["recognition"],
  ordering: ["production"],
  cloze: ["production"],
  "self-compare": ["speaking"],
};

/** Activities that are not practice and are not expected to carry a mode. */
const NOT_PRACTICE: readonly string[] = ["information", "examples"];

export type Modes = Readonly<Record<Mode, boolean>>;

export type LessonOutcome = {
  unitId: string;
  unitTitle: string;
  id: string;
  title: string;
  family: string;
  /** The authored objective, verbatim — the matrix's reason to exist. */
  objective: string;
  minutes: number;
  prerequisites: string[];
  introducesVocabulary: string[];
  retrievesVocabulary: string[];
  introducesConcepts: string[];
  retrievesConcepts: string[];
  modes: Mode[];
  /** Lessons this one retrieves material from, via its retained exercises. */
  retrievesLessons: string[];
};

export type CourseOutcomes = {
  language: string;
  title: string;
  version: string;
  lessons: number;
  units: number;
  proseReview: ProseReview["nativeSpeaker"];
  audioReview: ProseReview["audioListening"];
  reviewNote?: string;
  rows: LessonOutcome[];
  /** Named, mechanically derived, never ranked. Ranking is the editorial half. */
  gaps: string[];
};

export type OutcomeMatrix = {
  courses: CourseOutcomes[];
};

/** Every activity a lesson can reach, including optional support activities. */
function reachableActivities(pack: RuntimePack, lesson: RuntimeLesson): Activity[] {
  const ids = [
    ...lesson.steps.map((step) => step.activityId),
    ...lesson.steps.flatMap((step) => (step.supportActivityId ? [step.supportActivityId] : [])),
  ];
  const seen = new Set<string>();
  const activities: Activity[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const activity = pack.activities[id];
    if (activity) activities.push(activity);
  }
  return activities;
}

/** Modes an activity contributes, plus whether it contributed at all. */
function modesOf(activity: Activity): { modes: Mode[]; mapped: boolean } {
  if (NOT_PRACTICE.includes(activity.kind)) return { modes: [], mapped: true };
  const authoured = "skills" in activity && Array.isArray(activity.skills) ? activity.skills : [];
  const fromSkills = new Set<Mode>();
  for (const skill of authoured) for (const mode of MODE_BY_SKILL[skill] ?? []) fromSkills.add(mode);
  if (fromSkills.size > 0) return { modes: [...fromSkills], mapped: true };
  const fromKind = MODE_BY_KIND[activity.kind];
  if (fromKind) return { modes: [...fromKind], mapped: true };
  return { modes: [], mapped: false };
}

/**
 * Build one course's matrix.
 *
 * Curriculum order is the pack's own lesson order, which is the order the
 * prerequisite chain enforces. A word or concept is *introduced* by the first
 * lesson that references it and *retrieved* by every later one, so the columns
 * add up to the course's own vocabulary list rather than to a second count.
 */
export function buildCourseOutcomes(pack: RuntimePack, review: ProseReview): CourseOutcomes {
  const unitById = new Map(pack.units.map((unit) => [unit.id, unit]));
  const declaredWords = new Set(pack.vocabulary.map((entry) => entry.id));

  const introducedWords = new Set<string>();
  const introducedConcepts = new Set<string>();
  const referencedWords = new Set<string>();
  const rows: LessonOutcome[] = [];
  const unmappedKinds = new Map<string, number>();

  for (const lesson of pack.lessons) {
    const activities = reachableActivities(pack, lesson);
    const modes = new Set<Mode>();
    for (const activity of activities) {
      const { modes: contributed, mapped } = modesOf(activity);
      for (const mode of contributed) modes.add(mode);
      if (!mapped) unmappedKinds.set(activity.kind, (unmappedKinds.get(activity.kind) ?? 0) + 1);
    }

    const words = [...new Set(lesson.vocabulary)].sort();
    const concepts = [...new Set(lesson.conceptIds)].sort();
    const introducesVocabulary = words.filter((id) => !introducedWords.has(id));
    const retrievesVocabulary = words.filter((id) => introducedWords.has(id));
    const introducesConcepts = concepts.filter((id) => !introducedConcepts.has(id));
    const retrievesConcepts = concepts.filter((id) => introducedConcepts.has(id));
    for (const id of words) {
      introducedWords.add(id);
      referencedWords.add(id);
    }
    for (const id of concepts) introducedConcepts.add(id);

    const retrievesLessons = [
      ...new Set(
        lesson.legacyExercises
          .flatMap((exercise) => exercise.reviewOf)
          .filter((lessonId) => lessonId !== lesson.id),
      ),
    ].sort();

    rows.push({
      unitId: lesson.unitId,
      unitTitle: unitById.get(lesson.unitId)?.title ?? lesson.unitId,
      id: lesson.id,
      title: lesson.title,
      family: lesson.family,
      objective: lesson.objective,
      minutes: lesson.estimatedMinutes,
      prerequisites: lesson.prerequisites.map((entry) => entry.lessonId).sort(),
      introducesVocabulary,
      retrievesVocabulary,
      introducesConcepts,
      retrievesConcepts,
      modes: MODES.filter((mode) => modes.has(mode)),
      retrievesLessons,
    });
  }

  return {
    language: pack.language,
    title: pack.title,
    version: pack.version,
    lessons: pack.lessons.length,
    units: pack.units.length,
    proseReview: review.nativeSpeaker,
    audioReview: review.audioListening,
    ...(review.note ? { reviewNote: review.note } : {}),
    rows,
    gaps: courseGaps(pack, rows, declaredWords, referencedWords, unmappedKinds),
  };
}

/**
 * The gaps, derived and named.
 *
 * Each entry is a fact about the pack, not a judgement about it: a mode no lesson
 * carries, a unit nothing retrieves, a declared word no lesson uses, a reachable
 * activity whose mode the matrix cannot derive. Deciding which of them matter,
 * and in what order to author, is §4A's editorial half and is deliberately left
 * to a person.
 */
function courseGaps(
  pack: RuntimePack,
  rows: LessonOutcome[],
  declaredWords: Set<string>,
  referencedWords: Set<string>,
  unmappedKinds: Map<string, number>,
): string[] {
  const gaps: string[] = [];
  const lessonsWith = (mode: Mode): string[] =>
    rows.filter((row) => row.modes.includes(mode)).map((row) => row.id);

  for (const mode of MODES) {
    const carried = lessonsWith(mode);
    if (carried.length === 0) gaps.push(`no lesson carries ${mode} practice`);
  }
  const noProduction = rows.filter((row) => !row.modes.includes("production")).map((row) => row.id);
  if (noProduction.length > 0)
    gaps.push(`${noProduction.length} lessons carry no production practice: ${noProduction.join(", ")}`);
  const noListening = rows.filter((row) => !row.modes.includes("listening")).map((row) => row.id);
  if (noListening.length > 0)
    gaps.push(`${noListening.length} lessons carry no listening practice: ${noListening.join(", ")}`);

  const retrievedLessons = new Set(rows.flatMap((row) => row.retrievesLessons));
  for (const unit of pack.units) {
    const inUnit = rows.filter((row) => row.unitId === unit.id).map((row) => row.id);
    if (inUnit.length === 0) continue;
    if (!inUnit.some((id) => retrievedLessons.has(id)))
      gaps.push(`unit "${unit.title}" is never retrieved by a later lesson`);
  }

  const unused = [...declaredWords].filter((id) => !referencedWords.has(id)).sort();
  if (unused.length > 0)
    gaps.push(`${unused.length} declared words are referenced by no lesson: ${unused.join(", ")}`);

  for (const [kind, count] of [...unmappedKinds].sort(([a], [b]) => a.localeCompare(b)))
    gaps.push(`${count} reachable ${kind} activities map to no practice mode`);

  return gaps;
}

export function buildOutcomeMatrix(
  inputs: readonly { pack: RuntimePack; review: ProseReview }[],
): OutcomeMatrix {
  return { courses: inputs.map(({ pack, review }) => buildCourseOutcomes(pack, review)) };
}

const list = (values: readonly string[]): string => (values.length === 0 ? "—" : values.join(", "));

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** The document `docs/curriculum-matrix.md` holds. Same matrix in, same bytes out. */
export function renderOutcomeMatrix(matrix: OutcomeMatrix): string {
  const lines: string[] = [];
  lines.push("# Curriculum matrix", "");
  lines.push(
    "Generated by `npm run content:outcomes -- --write` from `courses/<language>/manifest.json`.",
    "Do not edit by hand: `tests/curriculum-matrix.test.ts` rebuilds it and compares.",
    "",
  );
  lines.push("How to read a row:", "");
  lines.push(
    "- **modes** are the practice modes the lesson's own activities declare, from their authored",
    "  `skills` (reading/vocabulary → recognition, writing/grammar → production, listening,",
    "  speaking) and from the activity kind where a kind only means one thing. Nothing is inferred",
    "  from a kind that could mean two.",
    "- **introduces / retrieves** are counted in curriculum order: the first lesson referencing a",
    "  word or concept introduces it, every later one retrieves it.",
    "- **brings back** lists the lessons this lesson's retained exercises retrieve material from.",
    "- **review** is the course's record from `courses/<language>/review.json`, stated once per",
    "  course. It is not a per-lesson claim, and `docs/human-review-gates.md` is where the",
    "  outstanding human work is written down.",
    "",
  );

  lines.push("## Courses", "");
  lines.push(
    "| Course | Version | Lessons | Units | Recognition | Production | Listening | Speaking | Prose review | Audio review |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  );
  for (const course of matrix.courses) {
    const withMode = (mode: Mode): number => course.rows.filter((row) => row.modes.includes(mode)).length;
    lines.push(
      `| ${course.title} | ${course.version} | ${course.lessons} | ${course.units} | ${withMode("recognition")} | ${withMode("production")} | ${withMode("listening")} | ${withMode("speaking")} | ${course.proseReview.status} | ${course.audioReview.status} |`,
    );
  }
  lines.push("");

  for (const course of matrix.courses) {
    lines.push(`## ${course.title} (${course.language})`, "");
    lines.push(`Prose review: **${course.proseReview.status}**${course.proseReview.date ? ` (${course.proseReview.date}, reported by ${course.proseReview.reportedBy ?? "an unrecorded source"})` : ""}`);
    lines.push(`Audio listening review: **${course.audioReview.status}**`, "");
    if (course.proseReview.pending) lines.push(`Pending: ${course.proseReview.pending}`, "");
    if (course.reviewNote) lines.push(`${course.reviewNote}`, "");

    const units = [...new Set(course.rows.map((row) => row.unitId))];
    for (const unitId of units) {
      const unitRows = course.rows.filter((row) => row.unitId === unitId);
      lines.push(`### Unit ${unitId.replace(/^.*-unit-/, "")} — ${unitRows[0]?.unitTitle ?? unitId}`, "");
      for (const row of unitRows) {
        lines.push(`- **${row.id}** — ${row.title} (${row.family}, ${row.minutes} min)`);
        lines.push(`  - objective: ${row.objective}`);
        lines.push(`  - prerequisites: ${list(row.prerequisites)}`);
        lines.push(
          `  - introduces: ${plural(row.introducesVocabulary.length, "word")}, ${plural(row.introducesConcepts.length, "concept")} · ` +
            `retrieves: ${plural(row.retrievesVocabulary.length, "word")}, ${plural(row.retrievesConcepts.length, "concept")}`,
        );
        lines.push(`  - modes: ${list(row.modes)}`);
        lines.push(`  - brings back: ${list(row.retrievesLessons)}`);
      }
      lines.push("");
    }
  }

  lines.push("## Gaps", "");
  lines.push(
    "Mechanically derived from the packs, in curriculum order. Naming a gap is not ranking it:",
    "which of these to author, and in what order, is the editorial half of Phase 4A.",
    "",
  );
  for (const course of matrix.courses) {
    lines.push(`### ${course.title}`, "");
    if (course.gaps.length === 0) lines.push("- none derived from the packs", "");
    for (const gap of course.gaps) lines.push(`- ${gap}`);
    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}
