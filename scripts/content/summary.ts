import type { ContentReport } from "./report";

/**
 * One generated summary, derived from the per-language reports.
 *
 * The reports already describe each course; what did not exist was anything that
 * added them up. `README.md` and `docs/astra/phase-status.md` carried the totals
 * by hand, so when the café lessons added two French and Italian lessons
 * the prose kept saying 76 lessons and 614 practice activities while the reports
 * said 78 and 634 — and nothing failed, because nothing compared them.
 *
 * This module is that comparison point. It derives the five facts prose tends to
 * quote — lesson totals, practice activities, listening coverage, speaking
 * coverage and review state — from the reports, renders them as the two tables
 * the docs actually use, and is the only thing `README.md` and
 * `docs/cefr-coverage.md` take their numbers from.
 *
 * Basis rules it inherits and must not blur:
 * - practice activities are reachable *practice* activities: notices, information
 *   steps and retained v1 records are counted separately and never added in;
 * - foundation packs are the five `courses/<language>` packs, never the legacy
 *   travel fixture;
 * - a review state is quoted from the record, never inferred from green tests.
 */

export const REGION_START = "<!-- generated:content-summary:start -->";
export const REGION_END = "<!-- generated:content-summary:end -->";

export type LanguageSummary = {
  language: string;
  packId: string;
  schemaVersion: number;
  version: string;
  lessons: number;
  units: number;
  concepts: number;
  practiceActivities: number;
  noticeSteps: number;
  reachableActivities: number;
  retainedRecords: number;
  targetLanguageProduction: number;
  speakingActivities: number;
  speakingLessons: number;
  listeningLessons: number;
  listeningLessonsTotal: number;
  audioClips: number;
  vocabulary: number;
  authoredCefrTags: string;
  lessonFamilies: Record<string, number>;
  proseReview: string;
  audioListeningReview: string;
};

export type ContentSummary = {
  /** What each figure is, so a reader of the JSON cannot guess wrong. */
  basis: {
    languages: string;
    lessons: string;
    practiceActivities: string;
    noticeSteps: string;
    speakingCoverage: string;
    listeningCoverage: string;
    reviewState: string;
  };
  languages: LanguageSummary[];
  totals: {
    languages: number;
    lessons: number;
    practiceActivities: number;
    noticeSteps: number;
    speakingActivities: number;
    vocabulary: number;
    audioClips: number;
  };
};

export function buildContentSummary(
  reports: readonly { language: string; report: ContentReport }[],
): ContentSummary {
  const languages = reports
    .map(({ language, report }) => summariseLanguage(language, report))
    .sort((left, right) => left.language.localeCompare(right.language));

  const total = (pick: (entry: LanguageSummary) => number): number =>
    languages.reduce((sum, entry) => sum + pick(entry), 0);

  return {
    basis: {
      languages:
        "the five foundation packs in courses/<language>/manifest.json; the legacy travel fixture is counted separately and never added here",
      lessons:
        "authored lessons in the pack; a lesson count is capacity, never evidence of a CEFR level",
      practiceActivities:
        "distinct authored activities reachable from lesson steps, excluding notices/information steps and excluding retained v1 records",
      noticeSteps:
        "information activities: the notice step a lesson opens with, which is not graded practice",
      speakingCoverage:
        "lessons carrying a self-compare activity, and how many such activities exist",
      listeningCoverage:
        "lessons whose reachable activities include a listening-skill activity, against the lesson total; audio clips are the clips the pack's own media array references",
      reviewState:
        "quoted from courses/<language>/review.json via readProseReview; prose review and audio listening review are separate facts",
    },
    languages,
    totals: {
      languages: languages.length,
      lessons: total((entry) => entry.lessons),
      practiceActivities: total((entry) => entry.practiceActivities),
      noticeSteps: total((entry) => entry.noticeSteps),
      speakingActivities: total((entry) => entry.speakingActivities),
      vocabulary: total((entry) => entry.vocabulary),
      audioClips: total((entry) => entry.audioClips),
    },
  };
}

function summariseLanguage(language: string, report: ContentReport): LanguageSummary {
  const tags = Object.entries(report.authoredCefrTags.counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([tag, count]) => `${tag} × ${count} lessons`)
    .join(", ");
  return {
    language,
    packId: report.id,
    schemaVersion: report.schemaVersion,
    version: report.version,
    lessons: report.lessons,
    units: report.units,
    concepts: report.concepts,
    practiceActivities: report.runtimeActivities.practice,
    noticeSteps: report.runtimeActivities.information,
    reachableActivities: report.runtimeActivities.reachable,
    retainedRecords: report.legacyExercises.retained,
    targetLanguageProduction: report.production.targetLanguage,
    speakingActivities: report.speaking.activities,
    speakingLessons: report.speaking.lessons,
    listeningLessons: report.listening.lessons,
    listeningLessonsTotal: report.listening.lessonsTotal,
    audioClips: report.listening.audioClips,
    vocabulary: report.vocabulary.declared,
    authoredCefrTags: tags.length > 0 ? tags : "none on the pack",
    lessonFamilies: report.lessonFamilies ?? {},
    proseReview: report.review.nativeSpeaker,
    audioListeningReview: report.review.audioListening,
  };
}

const title = (language: string): string =>
  language.charAt(0).toUpperCase() + language.slice(1);

/** The table `README.md` carries: the course facts a reader compares. */
export function renderSummaryTable(summary: ContentSummary): string {
  const lines = [
    "| Course | Schema | Lessons | Practice activities | Notice steps | Speaking steps | Lessons with model audio | Audio clips | Vocabulary |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const entry of summary.languages)
    lines.push(
      `| ${title(entry.language)} | v${entry.schemaVersion} | ${entry.lessons} | ${entry.practiceActivities} | ${entry.noticeSteps} | ${entry.speakingActivities} | ${entry.listeningLessons}/${entry.listeningLessonsTotal} | ${entry.audioClips} | ${entry.vocabulary} |`,
    );
  const { totals } = summary;
  const totalLine = summary.languages
    .map((entry) => `${entry.lessons}`)
    .join(" + ");
  lines.push(
    "",
    `${totals.lessons} lessons (${totalLine}), ${totals.practiceActivities} practice activities, and ${totals.speakingActivities} speaking steps.`,
  );
  return lines.join("\n");
}

/** The table `docs/cefr-coverage.md` carries: the same facts plus the tags. */
export function renderCoverageTable(summary: ContentSummary): string {
  const lines = [
    "| Course | Schema | Lessons | Practice activities | Notice steps | Target-language production | Speaking steps | Lessons with model audio | Authored CEFR tags |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const entry of summary.languages)
    lines.push(
      `| ${title(entry.language)} | v${entry.schemaVersion} | ${entry.lessons} | ${entry.practiceActivities} | ${entry.noticeSteps} | ${entry.targetLanguageProduction} | ${entry.speakingActivities} | ${entry.listeningLessons}/${entry.listeningLessonsTotal} | ${entry.authoredCefrTags} |`,
    );
  lines.push("", `Totals: ${summary.totals.lessons} lessons, ${summary.totals.practiceActivities} practice activities, ${summary.totals.speakingActivities} speaking steps.`);
  return lines.join("\n");
}

/** Every doc region the summary owns: the file, and what it puts there. */
export const SUMMARY_REGIONS: ReadonlyArray<{ file: string; render: (summary: ContentSummary) => string }> = [
  { file: "README.md", render: renderSummaryTable },
  { file: "docs/cefr-coverage.md", render: renderCoverageTable },
];

/** The summary as the checked-in JSON artifact holds it. */
export function renderSummaryJson(summary: ContentSummary): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

/** The region a doc should hold, markers included. */
export function renderRegion(
  summary: ContentSummary,
  render: (summary: ContentSummary) => string,
): string {
  return `${REGION_START}\n${render(summary)}\n${REGION_END}`;
}

/**
 * The region a document currently holds, or a throw naming the file.
 *
 * A document that loses its markers fails here rather than silently keeping
 * numbers nobody maintains — the failure mode this whole module exists for.
 */
export function extractRegion(file: string, contents: string): string {
  const start = contents.indexOf(REGION_START);
  const end = contents.indexOf(REGION_END);
  if (start === -1 || end === -1 || end < start)
    throw new Error(
      `${file} is missing the generated summary region (${REGION_START} … ${REGION_END}); restore the markers so the numbers stay generated`,
    );
  return contents.slice(start, end + REGION_END.length);
}

/** Replace the region in `contents`. Pure, so the test can compare bytes. */
export function applyRegion(
  file: string,
  contents: string,
  summary: ContentSummary,
  render: (summary: ContentSummary) => string,
): string {
  const current = extractRegion(file, contents);
  return contents.replace(current, renderRegion(summary, render));
}
