import type { Evaluation } from "./answer";
import type { Exercise } from "./schema";

/**
 * The grader speaks in taxonomy — "accent/diacritic issue", "acceptable
 * alternative", "word-order problem". Those are correct names for a grading
 * category and wrong words to say to a person. This module is the single place
 * that turns an evaluation into something a learner would actually be told, so
 * the vocabulary stays consistent and a copy test can pin it.
 *
 * Rules:
 * - Never render `Evaluation.category` in the UI. It stays machine-facing.
 * - Keep the authored detail (`result.explanation`) for errors: those lines are
 *   specific and genuinely useful ("Check the accents. They can change the
 *   meaning or grammatical form.").
 * - Acknowledgements rotate by exercise id, so a lesson does not repeat one
 *   catchphrase, and the same answer always gets the same reply (deterministic,
 *   SSR-safe, pinnable in a test).
 */

/** Warm, low-key acknowledgements. Rotated; never a grade, never a score. */
const APPROVED = [
  "That's it.",
  "Nice — that's the one.",
  "Exactly.",
  "Yes — that's right.",
  "Got it.",
] as const;

/** Kinds where the learner produced language rather than picked it. */
const PRODUCTIVE: ReadonlySet<Exercise["kind"]> = new Set([
  "think",
  "translate",
  "transform",
  "cloze",
  "order",
  "dictation",
]);

const SPOKEN_NUDGE = "Say it out loud once before you continue.";

const HEADLINES: Record<string, string> = {
  "wrong article": "Almost — the article is the wrong one.",
  "wrong gender": "Almost — check the gender.",
  "wrong number": "Almost — check singular or plural.",
  "wrong conjugation": "Almost — check the verb ending.",
  "wrong tense": "Almost — that's the wrong tense.",
  "wrong auxiliary": "Almost — check the helper verb.",
  "wrong preposition": "Almost — check the little word.",
  "missing word": "Something's missing.",
  "extra word": "One word too many.",
  "word-order problem": "Right words, wrong order.",
  "accent/diacritic issue": "Almost — the accents are off.",
  "nearly correct": "So close — check the spelling.",
  "incorrect answer": "Not quite.",
  "model revealed": "Here's the model.",
};

export type Feedback = {
  /** The line in bold. Never the grader's category. */
  headline: string;
  /** Supporting line, or "" when there is nothing useful to add. */
  detail: string;
  /** Reinforce the target-language model even on a right answer. */
  showModel: boolean;
};

const hash = (seed: string): number => {
  let value = 0;
  for (let i = 0; i < seed.length; i += 1)
    value = (value * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(value);
};

const pick = (seed: string, options: readonly string[]): string =>
  options[hash(seed) % options.length];

export function feedbackFor(result: Evaluation, exercise: Exercise): Feedback {
  if (result.category === "model revealed")
    return {
      headline: HEADLINES["model revealed"],
      detail:
        "Read it once, then say it out loud. It comes back sooner because you looked.",
      showModel: true,
    };

  if (result.accepted) {
    const headline = pick(exercise.id, APPROVED);
    if (result.category === "correct with typo")
      return {
        headline,
        detail:
          "You had the meaning — a letter slipped. Fix the spelling in your head, then say it.",
        showModel: true,
      };
    if (result.category === "acceptable alternative")
      return {
        headline,
        detail:
          "That works here too. The form below is the one you will hear most.",
        showModel: true,
      };
    return {
      headline,
      detail: PRODUCTIVE.has(exercise.kind) ? SPOKEN_NUDGE : "",
      showModel: true,
    };
  }

  return {
    headline: HEADLINES[result.category] ?? "Not quite.",
    detail: result.explanation,
    showModel: true,
  };
}
