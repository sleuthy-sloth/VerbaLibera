import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import { evaluateAnswer } from "@/features/course-pack/answer";

const italian = () =>
  normalizePack(JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")));
const french = () =>
  normalizePack(JSON.parse(readFileSync("courses/french/manifest.json", "utf8")));

describe("cloze prompts", () => {
  it.each(["italian", "french"])("%s cloze blanks stand for a whole answerable word", (language) => {
    // A blank that covers only part of the word ("___ao." for "Ciao.") cannot
    // be answered: the grader compares the fill with the full answer.
    const pack = language === "italian" ? italian() : french();
    const clozes = pack.lessons.flatMap((lesson) =>
      lesson.legacyExercises
        .filter((e) => e.kind === "cloze")
        .map((e) => ({ lessonId: lesson.id, exercise: e })),
    );
    expect(clozes.length).toBeGreaterThan(0);
    for (const { lessonId, exercise } of clozes) {
      const marker = exercise.prompt.indexOf("___");
      expect(marker, `${lessonId}/${exercise.id} has no blank`).toBeGreaterThanOrEqual(0);
      const after = exercise.prompt.slice(marker + 3).trim();
      // Punctuation after the blank is fine: the grader normalizes it. Only a
      // word fragment after the blank makes the step unanswerable.
      if (!after || /^[.!?,;:]+$/.test(after)) continue;
      for (const answer of exercise.answers) {
        const word = answer.trim().replace(/[.!?,;:]$/, "");
        // The visible remainder must be a whole trailing token, never a
        // fragment of the expected word.
        if (!after) continue;
        const remainderIsFragment =
          word.toLowerCase().endsWith(after.toLowerCase().replace(/[.!?,;:]$/, "")) &&
          after.toLowerCase().replace(/[.!?,;:]$/, "") !== word.toLowerCase();
        expect(
          remainderIsFragment,
          `${lessonId}/${exercise.id}: "${exercise.prompt}" leaves a fragment of "${answer}"`,
        ).toBe(false);
      }
    }
  });

  it("grades the corrected First words cloze from the visible blank alone", () => {
    const pack = italian();
    const exercise = pack.lessons
      .flatMap((l) => l.legacyExercises)
      .find((e) => e.id === "it-first-words-foundation-cloze-ciao")!;
    // What a learner can actually type into the blank.
    expect(evaluateAnswer("Ciao.", exercise).accepted).toBe(true);
    const activity = pack.activities["it-first-words-foundation-cloze-ciao"];
    expect(activity.kind).toBe("cloze");
  });
});
