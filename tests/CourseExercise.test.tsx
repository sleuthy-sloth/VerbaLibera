import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { ExerciseView } from "@/features/course-pack/ExerciseView";
it("records reading with a revealed translation as assisted practice", async () => {
  const p = validatePack(
      JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")),
    ),
    e = p.lessons
      .find((l) => l.id === "it-identity-foundation")!
      .exercises.find((e) => e.kind === "reading")!;
  const save = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(<ExerciseView pack={p} exercise={e} onSave={save} />);
  await user.click(screen.getByText("Sentence translation"));
  await user.type(screen.getByLabelText("Your answer"), "Anna");
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true }),
    true,
  );
});

it('lets a learner correct a built sentence by removing a selected word', async () => {
  const pack = validatePack(JSON.parse(readFileSync('courses/italian/manifest.json', 'utf8')));
  const exercise = pack.lessons.find(l => l.id === 'it-people-foundation')!.exercises.find(e => e.kind === 'order')!;
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  await user.click(screen.getByRole('button', { name: 'italiana.' }));
  await user.click(screen.getByRole('button', { name: 'Remove italiana.' }));
  for (const word of ['Lei', 'è', 'italiana.']) await user.click(screen.getByRole('button', { name: word }));
  await user.click(screen.getByRole('button', { name: 'Check answer' }));
  await user.click(screen.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }), false);
});

it('checks a missing word from an inline blank without requiring the whole sentence', async () => {
  const pack = validatePack(JSON.parse(readFileSync('courses/italian/manifest.json', 'utf8')));
  const exercise = pack.lessons.find(l => l.id === 'it-identity-foundation')!.exercises.find(e => e.kind === 'cloze')!;
  const save = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ExerciseView pack={pack} exercise={exercise} onSave={save} />);
  await user.type(screen.getByRole('textbox', { name: 'Missing word' }), 'sono');
  await user.click(screen.getByRole('button', { name: 'Check answer' }));
  await user.click(screen.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }), false);
});
