// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizePack } from "@/features/course-pack/normalize-pack";
import type { RuntimePack } from "@/features/course-pack/lesson-runtime";
import { MODES, buildOutcomeMatrix, renderOutcomeMatrix } from "../scripts/content/outcomes";
import { readProseReview } from "../scripts/content/review";

/**
 * The outcome matrix is an authoring document, so the risk is not that it throws
 * — it is that it goes quietly wrong: a lesson dropped, a mode counted from the
 * wrong evidence, a gap list that reads as "no gaps" because the derivation
 * stopped matching. These pin the relationships, and pin the checked-in document
 * against the packs.
 *
 * Deliberately not pinned: absolute lesson and mode totals. Those move whenever
 * content is authored, and a stale number here is the failure this document
 * exists to end.
 */

/** The five shipped courses: the directory name, and the pack it holds. */
const courses = (): Array<{ language: string; pack: RuntimePack }> =>
  ["french", "german", "italian", "portuguese", "spanish"].map((language) => ({
    language,
    pack: normalizePack(JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8"))),
  }));

const matrixFor = (pack: RuntimePack) =>
  buildOutcomeMatrix([{ pack, review: readProseReview(pack.language) }]).courses[0];

describe("the outcome matrix", () => {
  it("covers every lesson of every shipped course, in curriculum order, once", () => {
    for (const { pack } of courses()) {
      const course = matrixFor(pack);
      expect(course.rows.map((row) => row.id)).toEqual(pack.lessons.map((lesson) => lesson.id));
      expect(course.lessons).toBe(pack.lessons.length);
      expect(new Set(course.rows.map((row) => row.id)).size).toBe(course.rows.length);
    }
  });

  it("carries each lesson's authored objective, title and prerequisites verbatim", () => {
    // The objective is the column Phase 4A audits against; paraphrasing it would
    // make the audit a review of this file instead of the course.
    for (const { pack } of courses()) {
      const course = matrixFor(pack);
      for (const [index, row] of course.rows.entries()) {
        const lesson = pack.lessons[index];
        expect(row.objective).toBe(lesson.objective);
        expect(row.title).toBe(lesson.title);
        expect(row.minutes).toBe(lesson.estimatedMinutes);
        expect(row.prerequisites).toEqual(lesson.prerequisites.map((p) => p.lessonId).sort());
        expect(row.objective.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("counts a word as introduced once, then retrieved, and accounts for every declared one", () => {
    for (const { pack } of courses()) {
      const course = matrixFor(pack);
      const declared = new Set(pack.vocabulary.map((entry) => entry.id));
      const introduced = new Set<string>();
      const referenced = new Set<string>();

      for (const row of course.rows) {
        for (const word of row.introducesVocabulary) {
          expect(introduced.has(word), `${word} introduced twice`).toBe(false);
          introduced.add(word);
        }
        for (const word of row.retrievesVocabulary)
          expect(introduced.has(word), `${word} retrieved before it is introduced`).toBe(true);
        for (const word of [...row.introducesVocabulary, ...row.retrievesVocabulary]) {
          expect(declared.has(word), `${word} is not in the pack's vocabulary`).toBe(true);
          referenced.add(word);
        }
      }

      // A declared word no lesson references must be named, and only then: an
      // unreferenced word that no gap mentions is a silent hole.
      const unused = [...declared].filter((id) => !referenced.has(id));
      const named = course.gaps.some((gap) => gap.includes("referenced by no lesson"));
      expect(named, `${course.language}: ${unused.length} unreferenced words, named=${named}`).toBe(
        unused.length > 0,
      );
    }
  });

  it("derives speaking from the self-compare steps, not from a count of activities", () => {
    // Italian is the pack with speaking steps and its invariant is "every lesson
    // past the first two". Tying the column to that rule is what makes the row
    // mean something; counting activities would pass while pointing at the wrong
    // lessons.
    for (const { language, pack } of courses()) {
      const course = matrixFor(pack);
      const speaks = course.rows.filter((row) => row.modes.includes("speaking")).map((row) => row.id);
      const hasSelfCompare = pack.lessons
        .filter((lesson) =>
          lesson.steps.some((step) => pack.activities[step.activityId]?.kind === "self-compare"),
        )
        .map((lesson) => lesson.id);
      expect(speaks).toEqual(hasSelfCompare);
      if (language === "italian") expect(speaks).toHaveLength(pack.lessons.length - 2);
      // French authors none at all, so the column is not defaulting to present.
      if (language === "french") expect(speaks).toEqual([]);
    }
  });

  it("names a gap for every mode no lesson carries, and invents none", () => {
    for (const { pack } of courses()) {
      const course = matrixFor(pack);
      for (const mode of MODES) {
        const carried = course.rows.some((row) => row.modes.includes(mode));
        const named = course.gaps.some((gap) => gap === `no lesson carries ${mode} practice`);
        expect(named, `${course.language}: ${mode} carried=${carried} named=${named}`).toBe(!carried);
      }
    }
  });

  it("is deterministic: the same packs produce the same bytes", () => {
    const build = () =>
      buildOutcomeMatrix(
        ["french", "german", "italian", "portuguese", "spanish"].map((language) => ({
          pack: normalizePack(JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8"))),
          review: readProseReview(language),
        })),
      );
    expect(renderOutcomeMatrix(build())).toBe(renderOutcomeMatrix(build()));
  });

  it("matches the checked-in document, so the file cannot drift from the packs", () => {
    const document = readFileSync("docs/curriculum-matrix.md", "utf8");
    const rendered = renderOutcomeMatrix(
      buildOutcomeMatrix(
        ["french", "german", "italian", "portuguese", "spanish"].map((language) => ({
          pack: normalizePack(JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8"))),
          review: readProseReview(language),
        })),
      ),
    );
    expect(
      document,
      "docs/curriculum-matrix.md is stale: run `npm run content:outcomes -- --write`",
    ).toBe(rendered);
  });

  it("names every course and its review record in the document", () => {
    const document = readFileSync("docs/curriculum-matrix.md", "utf8");
    for (const { pack } of courses()) {
      const course = matrixFor(pack);
      expect(document).toContain(`## ${course.title} (${course.language})`);
      expect(document).toContain(`Prose review: **${course.proseReview.status}**`);
      for (const row of course.rows) expect(document).toContain(`- **${row.id}** — ${row.title}`);
    }
  });
});
