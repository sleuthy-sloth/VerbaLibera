import { describe, it, expect } from "vitest";
import { evaluateAnswer } from "@/features/course-pack/answer";
import { feedbackFor } from "@/features/course-pack/feedback";
import { answerSchema, type AnswerSpec } from "@/features/course-pack/schema";
import type { Exercise } from "@/features/course-pack/schema";

/**
 * The grader is forgiving on purpose: a learner who produced the right word with
 * a slipped letter or a missing accent produced the answer. These tests exist so
 * that forgiveness is a decision on the record rather than something that erodes.
 * What must never be forgiven is a missing or reordered word, because that
 * changes the sentence.
 */

/**
 * Built through the real schema, never as a hand-written object literal: the
 * whole point is that forgiveness comes from the schema DEFAULT, and every one
 * of the 272 shipped exercises relies on that default rather than opting in.
 * A literal here would leave `allowTypo` undefined and quietly test a grader
 * nobody runs.
 */
const spec = (answers: string[], extra: Record<string, unknown> = {}): AnswerSpec =>
  answerSchema.parse({ answers, ...extra }) as AnswerSpec;

const exercise = { id: "ex-1", kind: "translate" } as Exercise;

describe("forgiving grading", () => {
  describe("accents", () => {
    it("accepts a missing accent and shows the accented form", () => {
      const r = evaluateAnswer("s'il vous plait", spec(["s'il vous plaît"]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("partial");
      expect(r.category).toBe("accent/diacritic issue");
      expect(r.correction).toBe("s'il vous plaît");
    });

    it("accepts Spanish accents and inverted punctuation together", () => {
      const r = evaluateAnswer("como estas", spec(["¿Cómo estás?"]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("partial");
      expect(r.correction).toBe("¿Cómo estás?");
    });

    it("accepts a German umlaut written without its diaeresis", () => {
      const r = evaluateAnswer("danke schon", spec(["danke schön"]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("partial");
    });

    it("refuses an accent that IS the word, not decoration on it", () => {
      // The accent-distinguished minimal pairs this must never forgive: Italian
      // "e" (and) vs "è" (is), French "a" (has) vs "à" (to), "ou" (or) vs "où"
      // (where), "la" vs "là" (there). Accepting these would teach the wrong
      // word, so the diagnostic is still given but the answer does not count.
      for (const [input, answer] of [
        ["e", "è"],
        ["a", "à"],
        ["ou", "où"],
        ["la", "là"],
      ] as const) {
        const r = evaluateAnswer(input, spec([answer]));
        expect(r.category, `${input} vs ${answer}`).toBe("accent/diacritic issue");
        expect(r.accepted, `${input} vs ${answer}`).toBe(false);
        expect(r.credit, `${input} vs ${answer}`).toBe("none");
      }
    });

    it("judges only the words that differ, so a short word elsewhere cannot veto", () => {
      // "un" is two letters but identical in both forms, so it must not block
      // forgiveness of the real accent error on "frère".
      const r = evaluateAnswer("J'ai un frere.", spec(["J'ai un frère."]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("partial");
      expect(r.correction).toBe("J'ai un frère.");
    });

    it("still forgives an accent on a word long enough to carry meaning", () => {
      expect(evaluateAnswer("tres", spec(["très"])).accepted).toBe(true);
      expect(evaluateAnswer("perche", spec(["perché"])).accepted).toBe(true);
    });

    it("still gives the plain accent headline when it will not accept the answer", () => {
      // The strict path keeps a learner-facing line too: it names the problem
      // without ever printing the grader's category.
      const f = feedbackFor(evaluateAnswer("e", spec(["è"])), exercise);
      expect(f.headline).toBe("Almost — the accents are off.");
      expect(f.showModel).toBe(true);
    });

    it("still accepts the accented form exactly, at full credit", () => {
      const r = evaluateAnswer("s'il vous plaît", spec(["s'il vous plaît"]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("full");
      expect(r.category).toBe("correct");
    });

    it("tells the learner which form needed the accent", () => {
      const f = feedbackFor(
        evaluateAnswer("danke schon", spec(["danke schön"])),
        exercise,
      );
      expect(f.showModel).toBe(true);
      expect(f.detail).toContain("danke schön");
      // Never the grader's vocabulary.
      expect(f.headline).not.toContain("accent/diacritic");
      expect(f.headline).not.toMatch(/diacritic/i);
    });
  });

  describe("common misspellings", () => {
    it("forgives one transposed letter in a longer word", () => {
      const r = evaluateAnswer("bonjuor", spec(["bonjour"]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("partial");
      expect(r.category).toBe("correct with typo");
      expect(r.correction).toBe("bonjour");
    });

    it("forgives a doubled or dropped letter", () => {
      expect(evaluateAnswer("bonjor", spec(["bonjour"])).accepted).toBe(true);
      expect(evaluateAnswer("mercci", spec(["merci"])).accepted).toBe(true);
    });

    it("forgives a misspelling inside a longer sentence", () => {
      const r = evaluateAnswer("merci beacoup", spec(["merci beaucoup"]));
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("partial");
      expect(r.correction).toBe("merci beaucoup");
    });

    it("refuses a misspelling that is no longer a single slip", () => {
      // "caffee" for "café" is three edits, so it is not a typo and is not
      // forgiven. This is the boundary of the tolerance, pinned so the rule
      // cannot quietly widen into accepting words the learner never learned.
      const r = evaluateAnswer(
        "je voudrais un caffee",
        spec(["je voudrais un café"]),
      );
      expect(r.accepted).toBe(false);
    });

    it("still rejects a real answer that is not a spelling slip", () => {
      const r = evaluateAnswer("bonsoir", spec(["bonjour"]));
      expect(r.accepted).toBe(false);
      expect(r.credit).toBe("none");
    });

    it("does not launder a grammar word into a typo", () => {
      // "le" for "la" is a grammatical error, not a slip. Its letters are too
      // few to carry meaning, so the short-word floor must refuse it.
      const r = evaluateAnswer("le table", spec(["la table"]));
      expect(r.accepted).toBe(false);
    });

    it("does not forgive two altered words at once", () => {
      const r = evaluateAnswer("bonjuor monsiur", spec(["bonjour monsieur"]));
      expect(r.accepted).toBe(false);
    });
  });

  describe("structural errors stay unaccepted", () => {
    it("rejects a dropped word even when the rest is right", () => {
      const r = evaluateAnswer("je voudrais café", spec(["je voudrais un café"]));
      expect(r.accepted).toBe(false);
      expect(r.category).toBe("missing word");
    });

    it("rejects an added word", () => {
      const r = evaluateAnswer(
        "je voudrais un grand café",
        spec(["je voudrais un café"]),
      );
      expect(r.accepted).toBe(false);
      expect(r.category).toBe("extra word");
    });

    it("rejects a word-order swap", () => {
      const r = evaluateAnswer("voudrais je un café", spec(["je voudrais un café"]));
      expect(r.accepted).toBe(false);
      expect(r.category).toBe("word-order problem");
    });
  });

  describe("strictness stays available", () => {
    it("is forgiving without any exercise opting in", () => {
      // 0 of the 272 shipped exercises set allowTypo, so the shipped behaviour
      // IS the schema default. This pins the default itself, because flipping it
      // back would silently make every lesson strict again.
      expect(answerSchema.parse({ answers: ["bonjour"] }).allowTypo).toBe(true);
    });

    it("lets an exercise opt out of typo forgiveness", () => {
      const r = evaluateAnswer(
        "bonjuor",
        spec(["bonjour"], { allowTypo: false }),
      );
      expect(r.accepted).toBe(false);
      expect(r.category).toBe("nearly correct");
    });

    it("never forgives a spelling slip through an omitted accent gate", () => {
      // Accents are forgiven regardless of the typo setting: the word is right.
      const r = evaluateAnswer(
        "bonjour",
        spec(["bonjour"], { allowTypo: false }),
      );
      expect(r.accepted).toBe(true);
      expect(r.credit).toBe("full");
    });
  });

  describe("credit reporting", () => {
    it("marks an exact answer full and an alternative full", () => {
      expect(evaluateAnswer("bonjour", spec(["bonjour", "salut"])).credit).toBe(
        "full",
      );
      expect(
        evaluateAnswer("salut", spec(["bonjour", "salut"])).category,
      ).toBe("acceptable alternative");
    });

    it("marks a wrong answer as no credit with the model to study", () => {
      const r = evaluateAnswer("au revoir", spec(["bonjour"]));
      expect(r.accepted).toBe(false);
      expect(r.credit).toBe("none");
      expect(r.model).toBe("bonjour");
    });

    it("never returns a credit value outside the three grades", () => {
      for (const [input, answers] of [
        ["bonjour", ["bonjour"]],
        ["bonjuor", ["bonjour"]],
        ["bonjour", ["bonjour"]],
        ["x", ["bonjour"]],
      ] as const)
        expect(["full", "partial", "none"]).toContain(
          evaluateAnswer(input, spec([...answers])).credit,
        );
    });
  });
});
