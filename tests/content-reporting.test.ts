import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { normalizePack } from "@/features/course-pack/normalize-pack";
import { buildContentReport, type ContentReport } from "../scripts/content/report";
import { buildListenCatalog, listenBytesFor, listenTracksFor } from "../scripts/content/listen";

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
  return { raw, report: buildContentReport(raw, normalizePack(raw), listen) };
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
      // Review status stays honestly pending until a human actually reviews.
      expect(report.review.nativeSpeaker).toBe("pending");
      expect(report.review.audioListening).toBe("pending");
    }
  });

  it("audio coverage counts model audio, not the existence of a legacy dictation", () => {
    const { report } = loadPack("german");
    // German's starter pack has one dictation but eight lessons; the old
    // metric reported exactly that dictation and called it coverage.
    expect(report.listening.lessonsTotal).toBe(8);
    expect(report.listening.lessonCoveragePercent).toBeLessThan(100);
    const french = loadPack("french").report;
    expect(french.listening.audioClips).toBeGreaterThan(0);
  });

  it.each(LANGUAGES)("the committed report for %s matches a fresh computation", (language) => {
    const committed = JSON.parse(
      fs.readFileSync(path.join(ROOT, "docs/astra/reports", `${language}.json`), "utf8"),
    );
    expect(committed).toEqual(loadPack(language).report);
  });
});
