import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { ExerciseView } from "@/features/course-pack/ExerciseView";
it("records reading with a revealed translation as assisted practice", async () => {
  const p = validatePack(
      JSON.parse(readFileSync("courses/french/manifest.json", "utf8")),
    ),
    e = p.lessons
      .find((l) => l.id === "fr-identity-foundation")!
      .exercises.find((e) => e.kind === "reading")!;
  const save = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(<ExerciseView pack={p} exercise={e} onSave={save} />);
  await user.click(screen.getByText("Sentence translation"));
  await user.type(screen.getByLabelText("Your answer"), "Anna");
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true }),
    true,
  );
});

it('lets a learner correct a built sentence by removing a selected word', async () => {
  const pack = validatePack(JSON.parse(readFileSync('courses/french/manifest.json', 'utf8')));
  const exercise = pack.lessons.find(l => l.id === 'fr-people-foundation')!.exercises.find(e => e.kind === 'order')!;
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  await user.click(screen.getByRole('button', { name: 'française.' }));
  await user.click(screen.getByRole('button', { name: 'Remove française.' }));
  for (const word of ['Elle', 'est', 'française.']) await user.click(screen.getByRole('button', { name: word }));
  await user.click(screen.getByRole('button', { name: 'Check answer' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }), false);
});

it('checks a missing word from an inline blank without requiring the whole sentence', async () => {
  const pack = validatePack(JSON.parse(readFileSync('courses/french/manifest.json', 'utf8')));
  const exercise = pack.lessons.find(l => l.id === 'fr-identity-foundation')!.exercises.find(e => e.kind === 'cloze')!;
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  await user.type(screen.getByRole('textbox', { name: 'Missing word' }), 'suis');
  await user.click(screen.getByRole('button', { name: 'Check answer' }));
  await user.click(screen.getByRole('button', { name: 'Continue' }));
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
