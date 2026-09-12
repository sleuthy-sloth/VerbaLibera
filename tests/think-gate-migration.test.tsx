import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { LessonPlayer } from "@/features/course-pack/LessonPlayer";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import {
  createMemoryLessonPractice,
  type CourseEnvironment,
} from "@/features/course-pack/environment";
import { validatePack } from "@/features/course-pack/schema";
import { makeLegacyRawPack } from "./fixtures/lesson-variety";

/**
 * The think-first pause has to survive the v1→v2 migration.
 *
 * A v1 `think` exercise hid the answer input until the learner pressed
 * "I've thought about it — let me answer". The v1→v2 adapter maps `think` to a
 * plain `text` activity, which renders an input immediately — so without a
 * compensating change, migrating a course converts its predictions into
 * fill-in-the-blanks and the Thinking Method's "say it before you see it"
 * disappears with no test noticing. The adapter therefore marks those steps
 * `purpose: "predict"` and the v2 player gates them.
 */

const french = normalizePack(
  JSON.parse(readFileSync("courses/french/manifest.json", "utf8")),
);
// Spanish is schemaVersion 2 as well now, and both v2 halves below read it that
// way.
const spanish = normalizePack(
  JSON.parse(readFileSync("courses/spanish/manifest.json", "utf8")),
);
// The legacy-player half needs a v1 pack, and no shipped pack is v1 any more —
// every course has flipped — so the host is the fixture, which authors a real
// Spanish `think` exercise for exactly this comparison.
const legacySpanish = validatePack(makeLegacyRawPack());

const environment = (): CourseEnvironment => ({
  capabilities: {
    accounts: false,
    synchronization: false,
    offlineInstall: false,
    hostedNavigation: false,
  },
  practice: {
    getDurability: () => "durable",
    subscribeDurability: () => () => {},
    read: async () => [],
    write: async () => {},
  },
  lessonPractice: createMemoryLessonPractice(),
  loadPack: vi.fn(),
  resolveMedia: (url) => url,
});

const THINK_STEP_ID = "fr-first-words-foundation-step-fr-first-words-foundation-think-bonjour";

describe("the think-first gate after migration", () => {
  it("marks every migrated think exercise as a prediction, and nothing else", () => {
    for (const pack of [french, spanish]) {
      const legacy = pack.lessons.flatMap((lesson) => lesson.legacyExercises);
      const thinkIds = legacy.filter((exercise) => exercise.kind === "think").map((e) => e.id);
      expect(thinkIds.length, `${pack.id} has no think exercises to check`).toBeGreaterThan(0);

      const predictIds = pack.lessons
        .flatMap((lesson) => lesson.steps)
        .filter((step) => step.purpose === "predict")
        .map((step) => step.activityId);
      expect(predictIds.sort()).toEqual(thinkIds.sort());
    }
  });

  it("keeps a legacy think exercise's prompt and answers through the migration", () => {
    // The gate is only worth preserving if it still asks the same question.
    for (const pack of [french, spanish]) {
      const think = pack.lessons
        .flatMap((lesson) => lesson.legacyExercises)
        .find((exercise) => exercise.kind === "think");
      if (!think || think.kind !== "think") throw new Error("expected a think exercise");
      const activity = pack.activities[think.id];
      expect(activity, `${think.id} is not reachable as an activity`).toBeDefined();
      expect(activity.kind).toBe("text");
      expect((activity as { prompt: string }).prompt).toBe(think.prompt);
      expect((activity as { answer: { answers: string[] } }).answer.answers).toEqual(think.answers);
    }
  });

  it("hides the input until the learner commits, then shows it", async () => {
    const practice = environment();
    // Resume straight onto the prediction rather than walking the lesson's
    // earlier steps: this test is about the gate, not about the walk.
    await practice.lessonPractice!.writeCheckpoint({
      packId: french.id,
      lessonId: "fr-first-words-foundation",
      revision: 1,
      stepId: THINK_STEP_ID,
      selectedBranches: {},
      assistance: [],
      draft: null,
      at: new Date().toISOString(),
    });

    render(
      <LessonPlayer
        pack={french}
        lessonId="fr-first-words-foundation"
        environment={practice}
        onExit={() => {}}
      />,
    );

    expect(await screen.findByText(/think first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your answer/i)).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: /i've thought about it/i }),
    );
    expect(screen.getByLabelText(/your answer/i)).toBeInTheDocument();
  });

  it("does not gate an ordinary practice step", async () => {
    // The same lesson, resumed onto the step before the prediction: a plain
    // practice step must never acquire the pause.
    const practice = environment();
    await practice.lessonPractice!.writeCheckpoint({
      packId: french.id,
      lessonId: "fr-first-words-foundation",
      revision: 1,
      stepId: "fr-first-words-foundation-step-fr-first-words-foundation-meet",
      selectedBranches: {},
      assistance: [],
      draft: null,
      at: new Date().toISOString(),
    });

    render(
      <LessonPlayer
        pack={french}
        lessonId="fr-first-words-foundation"
        environment={practice}
        onExit={() => {}}
      />,
    );

    expect(await screen.findByRole("radio", { name: "Hello." })).toBeVisible();
    expect(screen.queryByText(/think first/i)).toBeNull();
  });

  it("gates a v1 pack through the legacy player the same way", async () => {
    // Both players must make the same promise: the migrated pack and a pack
    // still on v1 are the same course shape.
    const think = legacySpanish.lessons
      .flatMap((lesson) => lesson.exercises)
      .find((exercise) => exercise.kind === "think");
    if (!think) throw new Error("the v1 fixture has no think exercise");
    const { ExerciseView } = await import("@/features/course-pack/ExerciseView");
    render(
      <ExerciseView
        pack={legacySpanish}
        exercise={think}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText(/think first/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your answer/i)).toBeNull();
  });
});
