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
  /** The complete-unit contract, per unit. */
  contracts: UnitContract[];
  /** Named, mechanically derived, never ranked. Ranking is the editorial half. */
  gaps: string[];
};

export type OutcomeMatrix = {
  courses: CourseOutcomes[];
};

/**
 * The four states a contract item can be in.
 *
 * `not-applicable` is a claim in its own right — the last unit cannot retrieve
 * material later, and a course that authors no speaking at all is a stated
 * position rather than a missing check — so it is never used as a softer word
 * for `absent`.
 */
export type ContractState = "present" | "absent" | "pending-review" | "not-applicable";

export type ContractItem = {
  item: string;
  state: ContractState;
  /** What was actually checked, and what it does not claim. */
  basis: string;
};

export type UnitContract = {
  unitId: string;
  unitTitle: string;
  lessons: string[];
  /**
   * Structurally complete enough to publish with review still open. Review is a
   * separate fact: `countsAsReviewed` is false unless the record says reviewed,
   * and a unit with pending review is publishable rather than blocked.
   */
  publishable: boolean;
  countsAsReviewed: boolean;
  items: ContractItem[];
  /** Structural observations that are not absences. Never an error by itself. */
  warnings: string[];
};

const REVIEW_BASIS =
  "read from courses/<language>/review.json via readProseReview; the record is per course, so this is the course's state and not a per-unit claim";

const EDITIONS_BASIS =
  "this column reports only that the pack's media are declared and reachable from steps; the editions themselves are gated by `npm run portable:build` + `portable:verify` and the offline/portable Playwright projects, which cannot be inferred from a pack";

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
  // Media no lesson references, counted at course scope: a per-unit count would
  // report every other unit's clips as unused, which is a false statement about
  // the pack.
  const courseReferencedMedia = new Set(
    pack.lessons.flatMap((lesson) => mediaOf(pack, lesson).referenced),
  );
  const unusedMedia = pack.media
    .filter((asset) => !courseReferencedMedia.has(asset.id))
    .map((asset) => asset.id)
    .sort();

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
    contracts: buildUnitContracts(pack, rows, review),
    gaps: courseGaps(pack, rows, declaredWords, referencedWords, unmappedKinds, unusedMedia),
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
  unusedMedia: string[],
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

  if (unusedMedia.length > 0)
    gaps.push(`${unusedMedia.length} declared clips are referenced by no lesson: ${unusedMedia.join(", ")}`);

  for (const [kind, count] of [...unmappedKinds].sort(([a], [b]) => a.localeCompare(b)))
    gaps.push(`${count} reachable ${kind} activities map to no practice mode`);

  return gaps;
}

export function buildOutcomeMatrix(
  inputs: readonly { pack: RuntimePack; review: ProseReview }[],
): OutcomeMatrix {
  return { courses: inputs.map(({ pack, review }) => buildCourseOutcomes(pack, review)) };
}

/** Media a lesson's reachable activities point at, and any reference that resolves to nothing. */
function mediaOf(
  pack: RuntimePack,
  lesson: RuntimeLesson,
): { referenced: string[]; dangling: string[] } {
  const declared = new Set(pack.media.map((asset) => asset.id));
  const referenced = new Set<string>();
  const dangling: string[] = [];
  const note = (id: string | undefined): void => {
    if (!id) return;
    if (declared.has(id)) referenced.add(id);
    else dangling.push(id);
  };
  for (const activity of reachableActivities(pack, lesson)) {
    if ("stimulusId" in activity && activity.stimulusId) {
      const stimulus = pack.stimuli[activity.stimulusId] as
        | { kind: string; mediaId?: string }
        | undefined;
      if (!stimulus) dangling.push(activity.stimulusId);
      else note(stimulus.mediaId);
    }
    if ("audioId" in activity && typeof activity.audioId === "string") note(activity.audioId);
  }
  return { referenced: [...referenced].sort(), dangling: [...dangling].sort() };
}

/**
 * The complete-unit contract: the state of each thing a released unit must be
 * able to report, per unit.
 *
 * Every item is derived from the pack and the review record, so nothing here can
 * claim that German is German: the structural facts are "this unit has a
 * production step", "every media reference resolves", "the record says the prose
 * was read". Pedagogical and language correctness stay with the reviewer, which
 * `docs/human-review-gates.md` owns.
 *
 * Absences are reported, not thrown. A unit may ship with listening absent and
 * with review open; what it cannot do is count as reviewed.
 */
export function buildUnitContracts(
  pack: RuntimePack,
  rows: LessonOutcome[],
  review: ProseReview,
): UnitContract[] {
  const lastUnitId = pack.units[pack.units.length - 1]?.id;
  const packAuthorsSpeaking = rows.some((row) => row.modes.includes("speaking"));
  const lessonById = new Map(pack.lessons.map((lesson) => [lesson.id, lesson]));

  return pack.units.map((unit, index) => {
    const unitRows = rows.filter((row) => row.unitId === unit.id);
    const ids = unitRows.map((row) => row.id);
    const unitRowIds = new Set(ids);
    const later = rows.slice(rows.findIndex((row) => unitRowIds.has(row.id)) + unitRows.length);
    const laterRetrieved = new Set([
      ...later.flatMap((row) => row.retrievesVocabulary),
      ...later.flatMap((row) => row.retrievesConcepts),
    ]);

    const lessons = ids.map((id) => lessonById.get(id)!);
    const media = lessons.map((lesson) => mediaOf(pack, lesson));
    const dangling = [...new Set(media.flatMap((entry) => entry.dangling))].sort();
    const referencedMedia = new Set(media.flatMap((entry) => entry.referenced));

    const missingObjective = unitRows.filter((row) => row.objective.trim().length === 0).map((row) => row.id);
    const missingPrerequisites = unitRows
      .filter((row) => row.prerequisites.length === 0 && index > 0)
      .map((row) => row.id);
    const unretrieved = [
      ...unitRows.flatMap((row) => [...row.introducesVocabulary, ...row.introducesConcepts]),
    ]
      .filter((id) => !laterRetrieved.has(id))
      .sort();
    const introduced = new Set([
      ...unitRows.flatMap((row) => [...row.introducesVocabulary, ...row.introducesConcepts]),
    ]);
    const noRecognition = unitRows.filter((row) => !row.modes.includes("recognition")).map((row) => row.id);
    const noProduction = unitRows.filter((row) => !row.modes.includes("production")).map((row) => row.id);
    const noListening = unitRows.filter((row) => !row.modes.includes("listening")).map((row) => row.id);
    const speaks = unitRows.some((row) => row.modes.includes("speaking"));
    const families = [...new Set(unitRows.map((row) => row.family))].sort();
    const unhashed = pack.media
      .filter((asset) => referencedMedia.has(asset.id) && !/^[0-9a-f]{64}$/.test(asset.sha256 ?? ""))
      .map((asset) => asset.id);

    const state = (ok: boolean, notApplicable = false): ContractState =>
      notApplicable ? "not-applicable" : ok ? "present" : "absent";
    const reviewState = (status: string): ContractState =>
      status === "reviewed" ? "present" : "pending-review";

    const warnings: string[] = [];
    if (noListening.length > 0)
      warnings.push(`${noListening.length} lesson(s) carry no listening practice: ${noListening.join(", ")}`);
    if (missingObjective.length > 0)
      warnings.push(`no authored objective: ${missingObjective.join(", ")}`);
    if (missingPrerequisites.length > 0)
      warnings.push(`no prerequisites declared: ${missingPrerequisites.join(", ")}`);
    if (unretrieved.length > 0)
      warnings.push(
        `${unretrieved.length} introduced item(s) are never retrieved later: ${unretrieved.slice(0, 6).join(", ")}${unretrieved.length > 6 ? " …" : ""}`,
      );
    if (families.length < 2 && unitRows.length > 1)
      warnings.push(`every lesson in this unit is family "${families[0] ?? "unspecified"}"`);
    if (dangling.length > 0)
      warnings.push(`media referenced but not declared: ${dangling.join(", ")}`);

    const items: ContractItem[] = [
      {
        item: "communicative objective",
        state: state(unitRows.every((row) => row.objective.trim().length > 0)),
        basis: "a non-empty authored objective on every lesson in the unit; the text itself is the reviewer's business, not this check's",
      },
      {
        item: "prerequisite concepts and vocabulary",
        state: state(missingPrerequisites.length === 0, index === 0),
        basis:
          index === 0
            ? "the first unit declares no prerequisites, which is not an absence"
            : "every lesson in the unit names at least one prerequisite lesson",
      },
      {
        item: "introduced and later-retrieved vocabulary and patterns",
        state: state(unretrieved.length === 0, unit.id === lastUnitId),
        basis:
          unit.id === lastUnitId
            ? `the last unit cannot be retrieved by a later one; it introduces ${introduced.size} item(s) that nothing in this course brings back`
            : `${introduced.size - unretrieved.length} of ${introduced.size} item(s) introduced here come back in a later lesson; ${unretrieved.length} do not. Counted in curriculum order from the lessons' own vocabulary and concept lists, not from the wording of any step`,
      },
      {
        item: "recognition practice",
        state: state(noRecognition.length === 0),
        basis: "every lesson carries at least one activity whose authored skills are reading or vocabulary",
      },
      {
        item: "target-language production",
        state: state(noProduction.length === 0),
        basis: "every lesson carries at least one activity whose authored skills are writing or grammar",
      },
      {
        item: "listening practice and referenced media",
        state: state(noListening.length === 0 && media.some((entry) => entry.referenced.length > 0)),
        basis: "every lesson carries a listening-skill activity and at least one media asset that its activities reference",
      },
      {
        item: "optional self-compare speaking",
        state: speaks ? "present" : packAuthorsSpeaking ? "absent" : "not-applicable",
        basis:
          "at least one lesson in the unit carries a self-compare activity; not-applicable means this course authors none anywhere, which is a stated position rather than a missing check",
      },
      {
        item: "lesson-family variety",
        state: state(families.length > 1 || unitRows.length <= 1),
        basis: "a multi-lesson unit uses more than one lesson family; single-lesson units are not asked for variety",
      },
      { item: "prose-review state", state: reviewState(review.nativeSpeaker.status), basis: REVIEW_BASIS },
      {
        item: "audio-listening-review state",
        state: reviewState(review.audioListening.status),
        basis: REVIEW_BASIS,
      },
      {
        item: "media provenance and integrity",
        state: state(dangling.length === 0 && unhashed.length === 0),
        basis:
          "every media id the unit's activities reference is declared on the pack with a sha256; whether the bytes match is `npm run content:audio-check`'s job, and this check does not stand in for it",
      },
      {
        item: "web, offline-download and portable compatibility",
        state: state(dangling.length === 0),
        basis: EDITIONS_BASIS,
      },
    ];

    // Structural absences block publication; listening, fresh retrieval and review
    // do not, because they are authoring and human-work states and a course that
    // halted on them could never ship anything as partial A1.
    const structural = ["communicative objective", "recognition practice", "target-language production", "media provenance and integrity"];
    const publishable = items
      .filter((entry) => structural.includes(entry.item))
      .every((entry) => entry.state === "present");

    return {
      unitId: unit.id,
      unitTitle: unit.title,
      lessons: ids,
      publishable,
      countsAsReviewed: review.nativeSpeaker.status === "reviewed",
      items,
      warnings,
    };
  });
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
    "- **unit contract** reports, per unit, whether each thing a released unit must be able to",
    "  report is `present`, `absent`, `pending review` or `not applicable`. Every state is derived",
    "  from the pack and the review record, so none of it claims the language is correct: the",
    "  structural facts are \"this unit has a production step\", \"every media reference resolves\",",
    "  \"the record says the prose was read\". A unit can be publishable with review open; it cannot",
    "  count as reviewed until a reviewer does. Absences are warnings, never build errors.",
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
      const contract = course.contracts.find((entry) => entry.unitId === unitId);
      if (contract) {
        lines.push("");
        lines.push("#### Unit contract", "");
        const withState = (state: ContractState): string[] =>
          contract.items.filter((item) => item.state === state).map((item) => item.item);
        const states: ReadonlyArray<readonly [ContractState, string]> = [
          ["present", "present"],
          ["absent", "absent"],
          ["pending-review", "pending review"],
          ["not-applicable", "not applicable"],
        ];
        for (const [state, label] of states) {
          const items = withState(state);
          if (items.length > 0) lines.push(`- ${label}: ${items.join(", ")}`);
        }
        lines.push(
          `- publishable: ${contract.publishable ? "yes" : "no"} · counts as reviewed: ${contract.countsAsReviewed ? "yes" : "no"}`,
        );
        // The one basis worth printing: it carries the arithmetic a reader needs to
        // see partial retrieval progress, which the states alone cannot show.
        const retrieval = contract.items.find(
          (item) => item.item === "introduced and later-retrieved vocabulary and patterns",
        );
        if (retrieval) lines.push(`- retrieval: ${retrieval.basis}`);
        lines.push(
          `- warnings: ${contract.warnings.length === 0 ? "none" : contract.warnings.join(" · ")}`,
        );
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
