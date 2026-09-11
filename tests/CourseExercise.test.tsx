import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { ExerciseView } from "@/features/course-pack/ExerciseView";

/**
 * The legacy (`schemaVersion` 1) exercise engine.
 *
 * These three cases used to run against the French pack. French is now
 * schemaVersion 2 and renders in the v2 player, so they run against German —
 * the v1 pack with the widest coverage of kinds. The behaviours being pinned
 * (a revealed translation counts as assistance, a tile can be taken back out of
 * an answer, a cloze grades the blank alone) belong to this engine, not to any
 * one language's content, so the assertions read their tokens and answers from
 * the pack instead of hardcoding them.
 */
const german = () => validatePack(JSON.parse(readFileSync("courses/german/manifest.json", "utf8")));
const exerciseOf = (lessonId: string, kind: string) => {
  const exercise = german()
    .lessons.find((lesson) => lesson.id === lessonId)!
    .exercises.find((candidate) => candidate.kind === kind);
  if (!exercise) throw new Error(`no ${kind} exercise in ${lessonId}`);
  return exercise;
};

it("records reading with a revealed translation as assisted practice", async () => {
  const p = german();
  const e = exerciseOf("de-first-words-foundation", "reading");
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
  const pack = german();
  const exercise = exerciseOf("de-introductions-foundation", "order");
  if (exercise.kind !== "order") throw new Error("expected an order exercise");
  // Derive the order from the answer rather than from the shuffled palette:
  // reading the tokens as authored is how this test first built "heiße Ich
  // Anna." and failed on a correct component.
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
  const pack = german();
  const exercise = exerciseOf("de-shopping-foundation", "cloze");
  // The prompt is "… ___ kostet der Kaffee?" — a blank in the middle of a
  // sentence, answered with one word.
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
  // component test ever rendered it. The German and Spanish and Portuguese
  // units now use it for grammar changes ("Change the pattern"), which makes
  // this the first real exercise of its kind and worth pinning.
  const pack = validatePack(
    JSON.parse(readFileSync("courses/german/manifest.json", "utf8")),
  );
  const exercise = pack.lessons
    .find((l) => l.id === "de-directions-foundation")!
    .exercises.find((e) => e.kind === "transform")!;
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);

  await user.type(screen.getByLabelText(/answer/i), "Entschuldigung, wo ist der Bahnhof?");
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true }),
    false,
  );
});

it("accepts a transform answer whose only error is a letter slip", async () => {
  // The forgiving grader, exercised through the component rather than the
  // engine alone: "Bahnhof" typed as "Banhof" is one edit and one word.
  const pack = validatePack(
    JSON.parse(readFileSync("courses/german/manifest.json", "utf8")),
  );
  const exercise = pack.lessons
    .find((l) => l.id === "de-directions-foundation")!
    .exercises.find((e) => e.kind === "transform")!;
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);

  await user.type(screen.getByLabelText(/answer/i), "Entschuldigung, wo ist der Banhof?");
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true, credit: "partial" }),
    false,
  );
});
