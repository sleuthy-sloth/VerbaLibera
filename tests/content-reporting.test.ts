import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { normalizePack } from "@/features/course-pack/normalize-pack";
import { buildContentReport, type ContentReport } from "../scripts/content/report";
import { buildListenCatalog, listenBytesFor, listenTracksFor } from "../scripts/content/listen";
import { readProseReview } from "../scripts/content/review";
import {
  REGION_END,
  REGION_START,
  SUMMARY_REGIONS,
  buildContentSummary,
  extractRegion,
  renderCoverageTable,
  renderRegion,
  renderSummaryTable,
} from "../scripts/content/summary";

/**
 * The reporting regression this file guards: `scripts/content.ts` used to count
 * `lesson.legacyExercises`, so the Italian v2 pack reported 199 "exercises"
 * while a learner actually meets 259 reachable activities — the whole
 * self-compare speaking rollout was invisible in the numbers that govern
 * expansion. `lessonsWithAudio` was equally wrong: it asked whether a legacy
 * dictation existed, not whether the lesson carries audio.
 *
 * The assertions below are written against the raw manifests rather than
 * against another call into the reporter, so a change in the reporter's
 * internals cannot satisfy them by agreeing with itself.
 */

const ROOT = process.cwd();
const LANGUAGES = ["french", "german", "italian", "portuguese", "spanish"] as const;
const catalog = buildListenCatalog(ROOT);

function loadPack(language: string): { raw: Record<string, unknown>; report: ContentReport } {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, "courses", language, "manifest.json"), "utf8"),
  ) as Record<string, unknown>;
  // The listen figures are measured from the shipped mp3s, exactly as
  // scripts/content.ts passes them — the report has to describe the audio that
  // exists, not the audio a pack's `media` array happens to mention (the long
  // tracks are in no pack's media array, which is why they went uncounted).
  const listen = {
    tracks: listenTracksFor(catalog, language),
    bytes: listenBytesFor(catalog, language),
  };
  // The review record is read per course, exactly as scripts/content.ts reads
  // it: a report has to describe the reviews that happened, not a constant.
  return { raw, report: buildContentReport(raw, normalizePack(raw), listen, readProseReview(language)) };
}

/** Independent census: every activity id a lesson's steps can reach. */
function reachableActivityIds(raw: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const lesson of (raw.lessons ?? []) as Array<{ steps?: Array<Record<string, string>> }>)
    for (const step of lesson.steps ?? []) {
      if (step.activityId) ids.add(step.activityId);
      if (step.supportActivityId) ids.add(step.supportActivityId);
    }
  return ids;
}

const sum = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((total, value) => total + value, 0);

describe("content reporting is schema-aware", () => {
  it.each(LANGUAGES)("%s reports reachable runtime activities, not retained v1 records", (language) => {
    const { raw, report } = loadPack(language);
    const schemaVersion = raw.schemaVersion as number;
    if (schemaVersion === 2) {
      // Reachability comes from the authored step graph, deduped.
      expect(report.runtimeActivities.reachable).toBe(reachableActivityIds(raw).size);
    } else {
      // v1 steps are generated 1:1 from the authored exercises plus one
      // notice step per lesson, so the reachable set is lessons + exercises.
      const exercises = (raw.lessons as Array<{ exercises: unknown[] }>).reduce(
        (total, lesson) => total + lesson.exercises.length,
        0,
      );
      expect(report.runtimeActivities.reachable).toBe(
        exercises + (raw.lessons as unknown[]).length,
      );
    }
    expect(report.legacyExercises.retained).toBeGreaterThan(0);
  });

  it("Italian's live activities appear in its report, not just its retained v1 records", () => {
    const { raw, report } = loadPack("italian");
    expect(raw.schemaVersion).toBe(2);
    // The whole v2 activity set — including the 23 self-compare speaking steps
    // the legacy census could not see at all.
    expect(report.runtimeActivities.reachable).toBeGreaterThan(report.legacyExercises.retained);
    expect(report.runtimeActivities.byKind["self-compare"]).toBeGreaterThan(0);
    expect(report.speaking.activities).toBe(report.runtimeActivities.byKind["self-compare"]);
    expect(report.speaking.lessons).toBeGreaterThan(0);
    expect(report.runtimeActivities.bySkill["speaking"]).toBe(report.speaking.activities);
  });

  it("keeps reachable and retained record sets separately labelled", () => {
    const { report } = loadPack("italian");
    expect(report.runtimeActivities.basis).toMatch(/authored activities reachable from lesson steps/);
    expect(report.legacyExercises.basis).toMatch(/retained for progress replay/);
    for (const block of [
      report.runtimeActivities,
      report.legacyExercises,
      report.production,
      report.speaking,
      report.listening,
      report.retrieval,
      report.vocabulary,
      report.prerequisites,
    ])
      expect(block.basis.length, "every metric names its basis").toBeGreaterThan(20);
  });

  it.each(LANGUAGES)("%s metrics explain their own denominator", (language) => {
    const { raw, report } = loadPack(language);
    const activities = report.runtimeActivities;
    expect(sum(activities.byKind)).toBe(activities.reachable);
    expect(activities.practice + activities.information).toBe(activities.reachable);
    expect(activities.byKind["information"] ?? 0).toBe(activities.information);
    expect(report.production.practice).toBe(activities.practice);
    expect(report.listening.lessonsTotal).toBe(report.lessons);
    expect(report.listening.lessonCoveragePercent).toBe(
      Math.round((report.listening.lessons / report.lessons) * 1000) / 10,
    );
    expect(report.vocabulary.declared).toBe((raw.vocabulary as unknown[]).length);
    expect(report.vocabulary.declared).toBe(
      report.vocabulary.referenced + report.vocabulary.unused,
    );
    expect(report.speaking.lessons).toBeLessThanOrEqual(report.lessons);
  });

  it("never claims a complete CEFR level from lesson count", () => {
    for (const language of LANGUAGES) {
      const { report } = loadPack(language);
      expect(report.level.claim).toBe("partial-A1");
      expect(report.level.detail).toMatch(/No complete A1 syllabus is claimed/);
      // A level claim is not a review claim. The listening review is still
      // pending everywhere, and the prose review is reported from the record
      // rather than asserted here — the case below owns that.
      expect(report.review.audioListening).toBe("pending");
      // Any of the three states, including "partial" — a course that grew after
      // its review is a real state and the report has to be able to say it.
      expect(["pending", "partial", "reviewed"]).toContain(report.review.nativeSpeaker);
    }
  });

  it("audio coverage counts model audio, not the existence of a legacy dictation", () => {
    const { report } = loadPack("german");
    // German's pack has one dictation and ten lessons; the old metric reported
    // exactly that dictation and called it coverage.
    expect(report.listening.lessonsTotal).toBe(10);
    expect(report.listening.lessonCoveragePercent).toBeLessThan(100);
    const french = loadPack("french").report;
    expect(french.listening.audioClips).toBeGreaterThan(0);
  });

  it("reports the prose review that was recorded, and only for the courses that have one", () => {
    // Gate 1 of docs/human-review-gates.md is closed for German and Spanish and
    // open for the rest. The report is where that fact is machine-readable, so a
    // report that disagrees with the record fails here rather than misleading
    // whoever reads it next.
    {
      const spanish = loadPack("spanish").report;
      expect(spanish.review.nativeSpeaker, "spanish prose review").toBe("reviewed");
      expect(spanish.review.note).toMatch(/reported by/);
      // The written course was reviewed, not the recordings.
      expect(spanish.review.audioListening, "spanish listening review").toBe("pending");
    }
    {
      // German's review covered the first eight lessons; the two that were
      // authored afterwards are not in it. "reviewed" here would claim a reading
      // of text no speaker has seen, so the record says partial and names what is
      // outstanding.
      const german = loadPack("german").report;
      expect(german.review.nativeSpeaker, "german prose review").toBe("partial");
      expect(german.review.note).toMatch(/part reviewed/i);
      expect(german.review.note).toMatch(/lessons 9-10/);
      expect(german.review.audioListening, "german listening review").toBe("pending");
    }
    for (const language of ["french", "italian", "portuguese"]) {
      const { report } = loadPack(language);
      expect(report.review.nativeSpeaker, `${language} prose review`).toBe("pending");
      expect(report.review.audioListening).toBe("pending");
    }
  });

  it.each(LANGUAGES)("the committed report for %s matches a fresh computation", (language) => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(ROOT, "docs/astra/reports", `${language}.json`), "utf8"),
    );
    expect(committed).toEqual(loadPack(language).report);
  });
});

/**
 * The drift this block exists to catch: the café lessons added a French and an
 * Italian lesson, and `README.md` kept saying "76 lessons, 614 practice
 * activities, and 23 speaking steps" because nothing derived those numbers.
 * `docs/astra/reports/summary.json` is now the one place they are derived, and
 * the prose blocks below are compared against it byte for byte.
 */
describe("one generated summary is the source for the figures prose quotes", () => {
  const summary = () =>
    buildContentSummary(LANGUAGES.map((language) => ({ language, report: loadPack(language).report })));
  const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), "utf8");

  it("the committed summary matches a fresh derivation from the committed reports", () => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(ROOT, "docs/astra/reports/summary.json"), "utf8"),
    );
    expect(committed).toEqual(summary());
  });

  it("adds up its parts and keeps the buckets separate", () => {
    const built = summary();
    const totalOf = (pick: (entry: (typeof built.languages)[number]) => number): number =>
      built.languages.reduce((sum, entry) => sum + pick(entry), 0);

    expect(built.totals.languages).toBe(LANGUAGES.length);
    expect(built.totals.lessons).toBe(totalOf((entry) => entry.lessons));
    expect(built.totals.practiceActivities).toBe(totalOf((entry) => entry.practiceActivities));
    expect(built.totals.speakingActivities).toBe(totalOf((entry) => entry.speakingActivities));
    expect(built.totals.audioClips).toBe(totalOf((entry) => entry.audioClips));

    for (const entry of built.languages) {
      // Notices are not practice; retained v1 records are not practice either.
      expect(
        entry.practiceActivities + entry.noticeSteps,
        `${entry.language}: practice + notices must account for every reachable activity`,
      ).toBe(entry.reachableActivities);
      expect(entry.listeningLessons).toBeLessThanOrEqual(entry.listeningLessonsTotal);
      expect(entry.speakingLessons).toBeLessThanOrEqual(entry.lessons);
    }
  });

  it("quotes review state from the records rather than from green tests", () => {
    for (const entry of summary().languages) {
      const report = loadPack(entry.language).report;
      expect(entry.proseReview, `${entry.language} prose review`).toBe(report.review.nativeSpeaker);
      expect(entry.audioListeningReview, `${entry.language} listening review`).toBe(
        report.review.audioListening,
      );
      // The two are separate facts and neither is inferred from the other.
      expect(["pending", "partial", "reviewed"]).toContain(entry.proseReview);
      expect(["pending", "partial", "reviewed"]).toContain(entry.audioListeningReview);
    }
  });

  it("names its own basis, so a reader of the JSON cannot guess what a figure means", () => {
    const { basis } = summary();
    for (const [field, text] of Object.entries(basis))
      expect(text.length, `${field} names its basis`).toBeGreaterThan(40);
    expect(basis.practiceActivities).toMatch(/excluding notices/);
    expect(basis.practiceActivities).toMatch(/retained v1 records/);
    expect(basis.languages).toMatch(/travel fixture/);
  });

  it.each(SUMMARY_REGIONS.map((region) => region.file))(
    "the generated block in %s matches the summary",
    (file) => {
      const region = SUMMARY_REGIONS.find((entry) => entry.file === file)!;
      const contents = read(file);
      expect(extractRegion(file, contents)).toBe(renderRegion(summary(), region.render));
    },
  );

  it("a document that loses its markers fails loudly rather than drifting", () => {
    const stripped = read("README.md").replace(REGION_START, "").replace(REGION_END, "");
    expect(() => extractRegion("README.md", stripped)).toThrow(/missing the generated summary region/);
  });

  it("catches a count that has moved: a doctored report cannot satisfy the prose", () => {
    // Non-vacuity. The comparison above is only worth having if a wrong number
    // trips it, so bump one language's lesson count and confirm the block the
    // prose would then have to hold is not the block it does hold.
    const reports = LANGUAGES.map((language) => ({ language, report: loadPack(language).report }));
    const doctored = reports.map((entry) =>
      entry.language === "french"
        ? { ...entry, report: { ...entry.report, lessons: entry.report.lessons + 1 } }
        : entry,
    );
    const built = buildContentSummary(doctored);
    const rendered = renderRegion(built, renderSummaryTable);

    expect(built.totals.lessons).toBe(summary().totals.lessons + 1);
    expect(rendered).not.toBe(extractRegion("README.md", read("README.md")));
  });

  it("phase-status quotes the same lesson counts the summary derives", () => {
    // Prose is not parsed wholesale: the specific figures it states are checked
    // against the summary, so a course that grows fails here instead of leaving
    // a sentence behind. Ranges (48–49) are left to the generated tables.
    const status = read("docs/astra/phase-status.md");
    expect(status).toContain("docs/astra/reports/summary.json");
    const lessonsOf = (language: string): number =>
      summary().languages.find((entry) => entry.language === language)!.lessons;
    expect(status).toContain(`${lessonsOf("french")} lessons each`);
    expect(status).toContain(`${lessonsOf("german")} lessons`);
    expect(status).toContain(`${lessonsOf("portuguese")} lessons each`);
  });

  it("renders both tables from the same summary, so the docs cannot disagree", () => {
    const built = summary();
    const readme = renderSummaryTable(built);
    const coverage = renderCoverageTable(built);
    for (const entry of built.languages) {
      expect(readme).toContain(`| ${entry.lessons} | ${entry.practiceActivities} |`);
      expect(coverage).toContain(`| ${entry.lessons} | ${entry.practiceActivities} |`);
      expect(readme).toContain(`${entry.listeningLessons}/${entry.listeningLessonsTotal}`);
      expect(coverage).toContain(`${entry.listeningLessons}/${entry.listeningLessonsTotal}`);
    }
    expect(readme).toContain(`${built.totals.lessons} lessons`);
    expect(coverage).toContain(`Totals: ${built.totals.lessons} lessons`);
  });
});
