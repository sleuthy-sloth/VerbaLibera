import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { join } from "node:path";

/**
 * German, Spanish and Portuguese teach the same topics, which is right. What is
 * not right is that they were the SAME LESSON three times: identical objectives,
 * identical exercise shapes, near-identical prompts, and answers that were the
 * same English string in every pack ("Hello.", "Thank you.", "Three times.").
 * Measured across all 24 topic pairs they shared 74-96% of their English text.
 *
 * Rewriting that is easy to undo by accident, and impossible to notice by
 * reading one lesson, so it is pinned here. The measurement is the same one
 * `scripts/content/cross-language-similarity.py` prints; keep the two in step.
 *
 * German is schemaVersion 2 as of the 2B flip, so the authored text has to be
 * read through both lesson shapes: v1 keeps the exercises and the explanation on
 * the lesson, v2 keeps the retained records in `legacyExercises` and relocates
 * the explanation into the lesson's opening `information` activity. Reading only
 * the v1 shape made every German comparison compare an empty list, which is the
 * kind of vacuous pass this file exists to prevent.
 */

const LANGS = ["german", "spanish", "portuguese"] as const;

/** Share the same slot in a course, so they are meant to be comparable. */
const topicOf = (id: string) => id.replace(/-foundation$/, "").split("-").slice(1).join("-");

type Exercise = {
  kind: string;
  prompt?: string;
  explanation?: string;
  passage?: string;
  translation?: string;
};
type Lesson = {
  id: string;
  objective?: string;
  explanation?: string;
  exercises?: Exercise[];
  legacyExercises?: Exercise[];
};
type RawPack = {
  lessons: Lesson[];
  activities?: Array<{ id: string; body?: string }>;
};

const load = (lang: string): RawPack =>
  JSON.parse(readFileSync(join(process.cwd(), "courses", lang, "manifest.json"), "utf8"));

/** The authored exercises, whichever schema the pack is on. */
const exercisesOf = (pack: RawPack, lesson: Lesson): Exercise[] =>
  lesson.exercises ?? lesson.legacyExercises ?? [];

/** The authored lesson prose, whichever schema the pack is on. */
const explanationOf = (pack: RawPack, lesson: Lesson): string =>
  lesson.explanation ??
  pack.activities?.find((activity) => activity.id === `${lesson.id}-intro`)?.body ??
  "";

/** Every authored English field, by position, so pairs line up field for field. */
function fields(pack: RawPack, lesson: Lesson): string[] {
  const out = [lesson.objective ?? "", explanationOf(pack, lesson)];
  for (const ex of exercisesOf(pack, lesson))
    for (const key of ["prompt", "explanation", "passage", "translation"] as const) {
      const value = ex[key];
      if (typeof value === "string" && value) out.push(value);
    }
  return out;
}

/** Levenshtein-based ratio, mirroring difflib.SequenceMatcher's 0..1 scale. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1)
    for (let j = 1; j <= b.length; j += 1)
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return 1 - rows[a.length][b.length] / Math.max(a.length, b.length);
}

const packs = Object.fromEntries(LANGS.map((l) => [l, load(l)])) as Record<
  (typeof LANGS)[number],
  RawPack
>;

const pairs: Array<{ topic: string; a: (typeof LANGS)[number]; b: (typeof LANGS)[number] }> = [];
for (let i = 0; i < LANGS.length; i += 1)
  for (let j = i + 1; j < LANGS.length; j += 1) {
    const seen = new Set(packs[LANGS[i]].lessons.map((l) => topicOf(l.id)));
    for (const topic of packs[LANGS[j]].lessons.map((l) => topicOf(l.id)))
      if (seen.has(topic)) pairs.push({ topic, a: LANGS[i], b: LANGS[j] });
  }

const lessonFor = (lang: (typeof LANGS)[number], topic: string) => {
  const found = packs[lang].lessons.find((l) => topicOf(l.id) === topic);
  if (!found) throw new Error(`${lang} has no lesson for ${topic}`);
  return found;
};

describe("cross-language lesson variety", () => {
  it("has same-topic lessons to compare at all", () => {
    // If the topic keys stop matching, every assertion below would vacuously
    // pass while comparing nothing. This is the canary for that.
    expect(pairs.length).toBeGreaterThanOrEqual(24);
  });

  it("reads the authored text of a migrated pack, not an empty list", () => {
    // Non-vacuity for the dual-schema accessors: German is v2, and if the
    // accessors stopped finding its exercises or its explanation every German
    // comparison above would pass while measuring nothing.
    for (const lang of LANGS) {
      const pack = packs[lang];
      for (const lesson of pack.lessons) {
        expect(exercisesOf(pack, lesson).length, `${lang}/${lesson.id} exercises`).toBeGreaterThan(
          0,
        );
        expect(explanationOf(pack, lesson).length, `${lang}/${lesson.id} explanation`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it.each(pairs.map((p) => [`${p.a}/${p.b}`, p.topic] as const))(
    "%s share no exercise shape for %s",
    (pairLabel, topic) => {
      const [a, b] = pairLabel.split("/") as [(typeof LANGS)[number], (typeof LANGS)[number]];
      const shapeA = exercisesOf(packs[a], lessonFor(a, topic))
        .map((e) => e.kind)
        .join(" > ");
      const shapeB = exercisesOf(packs[b], lessonFor(b, topic))
        .map((e) => e.kind)
        .join(" > ");
      expect(shapeA, `${topic}: both are "${shapeA}"`).not.toBe(shapeB);
    },
  );

  it.each(pairs.map((p) => [`${p.a}/${p.b}`, p.topic] as const))(
    "%s are not the same lesson in two languages for %s",
    (pairLabel, topic) => {
      const [a, b] = pairLabel.split("/") as [(typeof LANGS)[number], (typeof LANGS)[number]];
      const fa = fields(packs[a], lessonFor(a, topic));
      const fb = fields(packs[b], lessonFor(b, topic));
      const shared = Math.min(fa.length, fb.length);
      const scores: number[] = [];
      for (let i = 0; i < shared; i += 1) scores.push(similarity(fa[i], fb[i]));
      const average = scores.reduce((x, y) => x + y, 0) / scores.length;
      // Every pair measured 32-51% after the differentiation pass. 60% leaves
      // room to edit without tripping this, while a copy-paste lands far above.
      expect(
        average,
        `${topic} (${pairLabel}) is ${(average * 100).toFixed(0)}% identical: ${fa
          .map((f, i) => (scores[i] > 0.9 ? f.slice(0, 70) : ""))
          .filter(Boolean)
          .join(" | ")}`,
      ).toBeLessThan(0.6);
    },
  );
});
