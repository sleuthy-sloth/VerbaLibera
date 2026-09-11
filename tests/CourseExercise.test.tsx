import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { ExerciseView } from "@/features/course-pack/ExerciseView";

/**
 * The legacy (`schemaVersion` 1) exercise engine.
 *
 * These cases ran against the French pack, then German when French was flipped,
 * and now Spanish — the two are the same eight-lesson shape, so the move is a
 * rename rather than a rewrite. The behaviours being pinned (a revealed
 * translation counts as assistance, a tile can be taken back out of an answer,
 * a cloze grades the blank alone, a transform tolerates one letter slip) belong
 * to this engine, not to any one language's content, so the assertions read
 * their tokens and answers from the pack instead of hardcoding them.
 */
const spanish = () => validatePack(JSON.parse(readFileSync("courses/spanish/manifest.json", "utf8")));
const exerciseOf = (lessonId: string, kind: string) => {
  const exercise = spanish()
    .lessons.find((lesson) => lesson.id === lessonId)!
    .exercises.find((candidate) => candidate.kind === kind);
  if (!exercise) throw new Error(`no ${kind} exercise in ${lessonId}`);
  return exercise;
};

/** A one-letter slip in the longest word: the grader's forgiving case. */
function letterSlip(answer: string): string {
  const words = answer.split(" ");
  const index = words.reduce((best, word, at) => (word.length > words[best].length ? at : best), 0);
  const word = words[index];
  if (word.length < 5) throw new Error(`no long word to slip in: ${answer}`);
  words[index] = word.slice(0, 2) + word.slice(3);
  return words.join(" ");
}

it("records reading with a revealed translation as assisted practice", async () => {
  const p = spanish();
  const e = exerciseOf("es-first-words-foundation", "reading");
  const save = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(<ExerciseView pack={p} exercise={e} onSave={save} />);
  await user.click(screen.getByText("Sentence translation"));
  await user.type(screen.getByLabelText("Your answer"), e.answers[0]);
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true }),
    true,
  );
});

it('lets a learner correct a built sentence by removing a selected word', async () => {
  const pack = spanish();
  const exercise = exerciseOf("es-introductions-foundation", "order");
  if (exercise.kind !== "order") throw new Error("expected an order exercise");
  // Derive the order from the answer rather than from the shuffled palette:
  // reading the tokens as authored is how this test first built the sentence
  // backwards and failed on a correct component.
  const ordered = exercise.answers[0].split(" ").map((word) => {
    const token = exercise.tokens.find((candidate) => candidate === word);
    if (!token) throw new Error(`no token for ${word}`);
    return token;
  });
  const misclicked = ordered[ordered.length - 1];
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  await user.click(screen.getByRole("button", { name: misclicked }));
  await user.click(screen.getByRole("button", { name: `Remove ${misclicked}` }));
  for (const token of ordered) await user.click(screen.getByRole("button", { name: token }));
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }), false);
});

it('checks a missing word from an inline blank without requiring the whole sentence', async () => {
  const pack = spanish();
  const exercise = exerciseOf("es-shopping-foundation", "cloze");
  // The prompt is a blank in the middle of a sentence, answered with one word.
  expect(exercise.prompt).toContain("___");
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  await user.type(screen.getByRole("textbox", { name: "Missing word" }), exercise.answers[0]);
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }), false);
});

it("renders and grades a transform exercise, the kind the new units introduced", async () => {
  // `transform` existed in the schema and was never used by any lesson, so no
  // component test ever rendered it. The German, Spanish and Portuguese units
  // now use it for grammar changes ("Change the pattern"), which makes this the
  // first real exercise of its kind and worth pinning.
  const pack = spanish();
  const exercise = exerciseOf("es-directions-foundation", "transform");
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);

  await user.type(screen.getByLabelText(/answer/i), exercise.answers[0]);
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true }),
    false,
  );
});

it("accepts a transform answer whose only error is a letter slip", async () => {
  // The forgiving grader, exercised through the component rather than the
  // engine alone: one letter missing from one word is one edit and one word.
  const pack = spanish();
  const exercise = exerciseOf("es-directions-foundation", "transform");
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);

  await user.type(screen.getByLabelText(/answer/i), letterSlip(exercise.answers[0]));
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true, credit: "partial" }),
    false,
  );
});
