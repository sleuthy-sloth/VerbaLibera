import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExerciseView } from "@/features/course-pack/ExerciseView";
import type { CoursePack, Exercise } from "@/features/course-pack/schema";

const pack = {
  id: "foundations-french",
  language: "fr",
  vocabulary: [],
  media: [],
} as unknown as CoursePack;

const thinkExercise: Exercise = {
  id: "fr-identity-foundation-think-marc",
  conceptId: "fr-identity-concept",
  kind: "think",
  mode: "production",
  thinkSeconds: 10,
  prompt: "Think: how does Marc say “I am Marc”?",
  answers: ["Je suis Marc."],
  allowTypo: false,
  errors: [],
  explanation: "Same two building blocks.",
  vocabulary: [],
  reviewOf: [],
};

describe("think steps", () => {
  it("gates the input behind a think-first pause", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseView
        exercise={thinkExercise}
        pack={pack}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText(/think first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your answer/i)).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /i've thought about it/i }),
    );
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  });

  it("grades a predicted answer deterministically", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ExerciseView exercise={thinkExercise} pack={pack} onSave={onSave} />,
    );
    await user.click(
      screen.getByRole("button", { name: /i've thought about it/i }),
    );
    await user.type(screen.getByLabelText(/your answer/i), "Je suis Marc.");
    await user.click(screen.getByRole("button", { name: /check answer/i }));
    // The grader's category ("correct") is no longer rendered: the learner
    // gets an acknowledgement. See tests/exercise-feedback.test.tsx.
    const feedback = await screen.findByRole("status");
    expect(feedback).toHaveTextContent(/That's it\.|Nice|Exactly|Yes — that's right\.|Got it\./);
    expect(feedback).not.toHaveTextContent(/\bcorrect\b/);
  });
});
