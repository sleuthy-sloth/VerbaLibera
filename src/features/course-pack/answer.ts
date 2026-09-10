import type { AnswerSpec } from "./schema";
/**
 * `credit` says how much of the answer the learner actually produced. It is
 * deliberately separate from `accepted`, which only answers "does this advance
 * the lesson?" A missing accent is worth partial credit and acceptance, because
 * the learner produced the right word and a typography layer got in the way.
 */
export type Credit = "full" | "partial" | "none";
export type Evaluation = {
  accepted: boolean;
  credit: Credit;
  category: string;
  explanation: string;
  model: string;
  /**
   * The form to show back when the answer was accepted with something to fix.
   * Only set when there is a specific thing to see, so the UI can render a
   * correction instead of a bare acknowledgement.
   */
  correction?: string;
};
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[¿¡!?.,;:"“”()[\]{}]/g, " ")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
const unaccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
// Bounded edit distance, including adjacent transposition. Never a semantic grader.
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}
export function evaluateAnswer(response: string, spec: AnswerSpec): Evaluation {
  const input = normalize(response);
  const model = spec.answers[0] ?? "";
  const result = (
    category: string,
    explanation: string,
    accepted = false,
    credit: Credit = "none",
    correction?: string,
  ): Evaluation => ({ category, explanation, accepted, credit, model, correction });
  if (!input || input.length > 1000)
    return result(
      "incorrect answer",
      "Write an answer, or study the model and try again.",
    );
  const exact = spec.answers.findIndex((a) => normalize(a) === input);
  if (exact >= 0)
    // `feedbackFor` supplies the learner-facing wording; this string exists so
    // the evaluation is self-describing and must never say "authored answer" —
    // that is answer-key vocabulary, not something to show a person.
    return result(
      exact === 0 ? "correct" : "acceptable alternative",
      exact === 0
        ? "That is the answer."
        : "That is one of the accepted forms.",
      true,
      "full",
    );
  const error = spec.errors?.find((e) => normalize(e.answer) === input);
  if (error) return result(error.category, error.explanation);
  // Accents are a typography layer, not knowledge, so a missing one is accepted
  // with the accented form shown back rather than counted wrong. But only where
  // the accent decorates a word: in Italian "e" (and) and "è" (is), in French
  // "a" (has) and "à" (to), "ou" (or) and "où" (where), are different words, and
  // forgiving those erases the grammar the accent is carrying. So the rule is
  // judged per DIFFERING word and only above a length floor, which leaves short
  // words elsewhere in the sentence ("un", "a") free to stay short.
  for (const answer of spec.answers) {
    const expected = normalize(answer);
    if (unaccent(expected) !== unaccent(input)) continue;
    const a = input.split(" ");
    const b = expected.split(" ");
    if (a.length !== b.length) continue;
    const forgiving = a.every((word, i) => {
      if (word === b[i]) return true;
      const bare = unaccent(word);
      return bare === unaccent(b[i]) && bare.length >= 4;
    });
    if (!a.some((word, i) => word !== b[i])) continue;
    // The diagnostic is worth giving either way: a learner who wrote "e" for
    // "è" has an accent problem and should be told so. Only the acceptance is
    // withheld, because there the accent is the whole word.
    return result(
      "accent/diacritic issue",
      "Right word — the written form carries accents. They change the meaning or grammatical form.",
      forgiving,
      forgiving ? "partial" : "none",
      forgiving ? answer : undefined,
    );
  }
  for (const answer of spec.answers) {
    const expected = normalize(answer);
    const a = input.split(" ");
    const b = expected.split(" ");
    if (
      a.length === b.length &&
      a.slice().sort().join(" ") === b.slice().sort().join(" ")
    )
      return result(
        "word-order problem",
        "The words are here; check their order against the model.",
      );
  }
  for (const answer of spec.answers) {
    const a = input.split(" "),
      b = normalize(answer).split(" ");
    const subsequence = (short: string[], long: string[]) => {
      let i = 0;
      for (const word of long) if (word === short[i]) i++;
      return i === short.length;
    };
    if (a.length < b.length && subsequence(a, b))
      return result(
        "missing word",
        "One or more words are missing. Compare the complete phrase.",
      );
    if (a.length > b.length && subsequence(b, a))
      return result(
        "extra word",
        "There are extra words. They may change the meaning. Compare the model.",
      );
  }
  for (const answer of spec.answers) {
    const expected = normalize(answer);
    if (expected.length > 1000) continue;
    const a = input.split(" "),
      b = expected.split(" ");
    // Only a same-length answer with exactly one altered word can be forgiven,
    // so a dropped or reordered word is never laundered into "a typo".
    if (a.length !== b.length || a.length === 0) continue;
    const idx = a.findIndex((w, i) => w !== b[i]);
    if (idx < 0) continue;
    if (a.filter((w, i) => w !== b[i]).length !== 1) continue;
    const wrong = a[idx],
      right = b[idx];
    // Both forms need enough letters to carry meaning: forgiving a one- or
    // two-letter slip would forgive a grammar word, which changes the sentence.
    if (wrong.length < 4 || right.length < 4) continue;
    const edited = distance(wrong, right);
    // A longer word earns one more edit, because "common misspelling" scales
    // with length and a single-slip rule rejects real typos in long words.
    const allowed = wrong.length >= 8 && right.length >= 8 ? 2 : 1;
    if (edited <= allowed)
      if (spec.allowTypo)
        return result(
          "correct with typo",
          "Meaning accepted with a small spelling slip; study the exact spelling.",
          true,
          "partial",
          answer,
        );
      else
        return result(
          "nearly correct",
          "A small spelling or grammar difference remains. Compare the model.",
        );
  }
  return result(
    "incorrect answer",
    "That is not the form we are looking for. Study the explanation, then try again.",
  );
}
