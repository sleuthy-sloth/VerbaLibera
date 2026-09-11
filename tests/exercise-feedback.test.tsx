import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { ExerciseView } from "@/features/course-pack/ExerciseView";
import { producesTargetLanguage } from "@/features/course-pack/feedback";

/**
 * The grader talks in taxonomy — "accent/diacritic issue", "acceptable
 * alternative", "word-order problem". Those are the right names for a grading
 * category and the wrong words to say to a person. Every correct answer used to
 * print the category itself, so a learner's first success read:
 *
 *     correct
 *     That matches an authored answer.
 *     [ Save and continue ]
 *
 * These tests pin the learner-facing wording in `feedback.ts` and fail if the
 * grader's vocabulary, or a database verb, reaches the screen again.
 */

/**
 * These cases exercise the legacy (`schemaVersion` 1) exercise engine, which
 * French no longer uses — it migrated to v2 and renders in the v2 player. They
 * run against German, a v1 pack, and pin learner-facing wording rather than any
 * one language's content: `feedback.ts` must never let the grader's taxonomy
 * reach the screen, whatever language the exercise is in.
 */
const pack = validatePack(
  JSON.parse(readFileSync("courses/german/manifest.json", "utf8")),
);
const all = pack.lessons.flatMap((l) => l.exercises);
const byId = (id: string) => all.find((e) => e.id === id)!;

const TAXONOMY = [
  "acceptable alternative",
  "accent/diacritic issue",
  "word-order problem",
  "nearly correct",
  "missing word",
  "extra word",
  "incorrect answer",
  "model revealed",
  "correct with typo",
  "authored answer",
  "save and continue",
];

const ACKNOWLEDGEMENTS = [
  "That's it.",
  "Nice — that's the one.",
  "Exactly.",
  "Yes — that's right.",
  "Got it.",
];

async function answerWith(
  id: string,
  value: string | null,
): Promise<{ feedback: HTMLElement; save: ReturnType<typeof vi.fn> }> {
  const exercise = byId(id);
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  if (value === null) {
    // A choice: pick the option the pack names as correct.
    await user.click(screen.getByRole("radio", { name: exercise.answers[0] }));
  } else {
    await user.type(screen.getByLabelText("Your answer"), value);
  }
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  return {
    feedback: document.querySelector(".study-feedback") as HTMLElement,
    save,
  };
}

describe("practice feedback", () => {
  it("only ever shows categories as correct answers, and never as words", async () => {
    // A recognition win: the option the pack marks correct.
    const choice = byId("de-first-words-foundation-meet");
    expect(choice.answers[0]).toBe("Hello.");
    const recognised = await answerWith(choice.id, null);
    expect(recognised.feedback.textContent?.toLowerCase()).not.toContain(
      "correct",
    );

    // A miss: the grader returns "incorrect answer" — the learner must not see it.
    const missed = await answerWith(
      "de-cafe-requests-foundation-vary",
      "Ich möchte ein Tee, bitte.",
    );
    for (const word of TAXONOMY)
      expect(missed.feedback.textContent?.toLowerCase()).not.toContain(word);
  });

  it("acknowledges a produced answer and asks the learner to say it out loud", async () => {
    const { feedback } = await answerWith(
      "de-cafe-requests-foundation-vary",
      "Ich möchte einen Tee, bitte.",
    );
    const headline = feedback.querySelector("strong")?.textContent ?? "";
    expect(ACKNOWLEDGEMENTS).toContain(headline);
    expect(feedback.textContent).toContain(
      "Say it out loud once before you continue.",
    );
    // The target-language form stays visible as reinforcement.
    expect(feedback.textContent).toContain("Ich möchte einen Tee, bitte.");
  });

  it("does not demand an out-loud rep for a recognition pick", async () => {
    const { feedback } = await answerWith(
      "de-first-words-foundation-meet",
      null,
    );
    const headline = feedback.querySelector("strong")?.textContent ?? "";
    expect(ACKNOWLEDGEMENTS).toContain(headline);
    expect(feedback.textContent).not.toContain("Say it out loud");
  });

  it("accepts a missing diacritic and shows the accented form back", async () => {
    // "mochte" for "möchte" is the right word with a diacritic missing, so it
    // counts. The learner is shown the accented form and never sees the
    // grader's vocabulary, which is the whole point of this module.
    const { feedback } = await answerWith(
      "de-cafe-requests-foundation-vary",
      "Ich mochte einen Tee, bitte.",
    );
    expect(feedback.textContent).toContain("Ich möchte einen Tee, bitte.");
    expect(feedback.textContent).not.toContain("accent/diacritic");
    expect(feedback.textContent).not.toMatch(/diacritic/i);
  });

  it("advances with a plain Continue, not a save operation", async () => {
    await answerWith("de-cafe-requests-foundation-vary", "Ich möchte einen Tee, bitte.");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save and continue" }),
    ).not.toBeInTheDocument();
  });

  it("marks the outcome visually as well as in words", async () => {
    // The panel carried no state at all in this engine: a right answer and a
    // wrong answer looked identical, so a learner skimming on a phone had no
    // signal beyond re-reading the sentence.
    const right = await answerWith("de-cafe-requests-foundation-vary", "Ich möchte einen Tee, bitte.");
    expect(right.feedback.getAttribute("data-outcome")).toBe("correct");

    cleanup();
    const wrong = await answerWith(
      "de-cafe-requests-foundation-vary",
      "Ich möchte ein Tee, bitte.",
    );
    expect(wrong.feedback.getAttribute("data-outcome")).toBe("attention");
  });

  it("treats a revealed model as neither right nor wrong", async () => {
    const exercise = byId("de-cafe-requests-foundation-vary");
    const save = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
    await user.click(screen.getByRole("button", { name: "Reveal model" }));
    const feedback = document.querySelector(".study-feedback") as HTMLElement;
    expect(feedback.getAttribute("data-outcome")).toBe("neutral");
    expect(feedback.querySelector("strong")?.textContent).toBe("Here's the model.");
  });

  it("only counts target-language answers as language the learner used", async () => {
    // The running "used this session" list is labelled as French output, and the
    // lesson summary says "You used N expressions in French". A `choice` asks
    // for the English meaning ("Hello.") and a `reading` is answered in English,
    // so neither may be counted — the first pass counted both.
    expect(producesTargetLanguage("choice")).toBe(false);
    expect(producesTargetLanguage("reading")).toBe(false);
    expect(producesTargetLanguage("think")).toBe(true);
    expect(producesTargetLanguage("translate")).toBe(true);
    expect(producesTargetLanguage("cloze")).toBe(true);
    expect(producesTargetLanguage("order")).toBe(true);
    expect(producesTargetLanguage("dictation")).toBe(true);
    expect(producesTargetLanguage("transform")).toBe(true);

    // And the model a choice grades against really is English, not the target
    // language.
    const choice = byId("de-first-words-foundation-meet");
    expect(choice.answers[0]).toBe("Hello.");
    expect(producesTargetLanguage(choice.kind)).toBe(false);
  });
});
