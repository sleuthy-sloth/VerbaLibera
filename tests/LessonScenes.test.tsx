import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CourseWorkspace } from "@/features/course-pack/CourseWorkspace";
import { RuntimeCourseWorkspace } from "@/features/course-pack/RuntimeCourseWorkspace";
import { createMemoryLessonPractice, type CourseEnvironment } from "@/features/course-pack/environment";
import type { RuntimePack } from "@/features/course-pack/lesson-runtime";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import type { PracticeEvent } from "@/features/course-pack/progress";
import { validatePack } from "@/features/course-pack/schema";

/**
 * Lesson scenes on both pack shells.
 *
 * The picture is keyed by situation (`src/features/course-pack/scenes.ts`), and both
 * shells that render a lesson ask that module — so these cases pin the wiring on
 * each: the v2 shell (`RuntimeCourseWorkspace`), the legacy shell
 * (`CourseWorkspace`), and the negative direction, where a lesson that is not one of
 * the five situations must render no picture at all.
 *
 * German is v2 and Spanish is v1, which is why one suite needs both. Neither course
 * ships the café lesson unlocked, so each case opens it the way the product does:
 * the v2 pack with its prerequisites satisfied in memory, the v1 pack with the
 * earlier lessons' practice events recorded. Stripping `prerequisites` outright is
 * not an option — the v1 validator rejects a pack with an unreachable lesson, which
 * is itself a good sign.
 */

type RawPack = {
  lessons: (Record<string, unknown> & { id: string; title: string })[];
};

const raw = (language: string): RawPack => JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8"));

/** The v2 pack with every lesson's prerequisites already satisfied. */
const openGerman = (): RuntimePack => {
  const pack = raw("german");
  pack.lessons = pack.lessons.map((lesson) => ({ ...lesson, prerequisites: [] }));
  return normalizePack(pack);
};

/** The v1 pack plus the practice events that unlock its third lesson. */
const spanishWithHistory = () => {
  const pack = validatePack(raw("spanish"));
  const events: PracticeEvent[] = pack.lessons
    .slice(0, 2)
    .flatMap((lesson) =>
      lesson.exercises.map((exercise, index) => ({
        id: `saved-${lesson.id}-${index}`,
        packId: pack.id,
        version: pack.version,
        exerciseId: exercise.id,
        at: "2026-09-06T12:00:00.000Z",
        correct: true,
        revealed: false,
      })),
    );
  return { pack, events };
};

/**
 * The environment decides which shell runs: `CourseWorkspace` hands off to
 * `RuntimeCourseWorkspace` when the environment offers a v2 course loader. Passing
 * both loaders made the "legacy" case below silently render the v2 shell with the
 * German pack — the same lesson title exists in both, so the click still worked and
 * only the intro's own wording gave it away.
 */
function environment(options: { events?: PracticeEvent[]; course?: () => Promise<RuntimePack> } = {}): CourseEnvironment {
  return {
    capabilities: { accounts: false, synchronization: false, offlineInstall: false, hostedNavigation: false },
    practice: {
      getDurability: () => "temporary",
      subscribeDurability: () => () => {},
      read: async () => options.events ?? [],
      write: async () => {},
    },
    lessonPractice: createMemoryLessonPractice(),
    loadPack: async () => validatePack(raw("spanish")),
    ...(options.course ? { loadCourse: options.course } : {}),
    resolveMedia: (url) => url,
    install: async () => {},
    isInstalled: async () => false,
  };
}

const sceneOnScreen = () => document.querySelector("img.lesson-scene");

const renderV2 = (pack: RuntimePack) =>
  render(
    <RuntimeCourseWorkspace
      pack={pack}
      environment={environment({ course: async () => openGerman() })}
      scope={null}
      language="german"
      onLanguageChange={() => {}}
      onProgressChanged={() => {}}
    />,
  );

describe("lesson scenes", () => {
  it("gives the café lesson its picture on the v2 shell", async () => {
    const user = userEvent.setup();
    const pack = openGerman();
    renderV2(pack);

    const lesson = pack.lessons.find((candidate) => candidate.id === "de-cafe-requests-foundation")!;
    await user.click(await screen.findByRole("button", { name: lesson.title }));

    const scene = sceneOnScreen();
    expect(scene, "the German café lesson renders no scene").not.toBeNull();
    expect(scene!.getAttribute("src")).toBe("/images/scenes/ordering-coffee.jpg");
    expect(scene!.getAttribute("width")).toBe("800");
    expect(scene!.getAttribute("height")).toBe("600");
    // Decorative: the heading and objective above it say what it shows.
    expect(scene!.getAttribute("alt")).toBe("");
    // And the lesson's own content is still there — the picture is added to the
    // shell rather than substituted for it.
    expect(screen.getByRole("heading", { name: lesson.title })).toBeVisible();
    expect(screen.getByRole("button", { name: "Begin practice" })).toBeVisible();
  });

  it("renders no picture for a lesson that is not one of the situations", async () => {
    const user = userEvent.setup();
    const pack = openGerman();
    renderV2(pack);

    const other = pack.lessons.find((candidate) => candidate.id === "de-family-people-foundation")!;
    await user.click(await screen.findByRole("button", { name: other.title }));
    expect(sceneOnScreen(), "a lesson with no situation rendered a picture").toBeNull();
    expect(screen.getByRole("heading", { name: other.title })).toBeVisible();
  });

  it("gives the café lesson its picture on the legacy shell too", async () => {
    const user = userEvent.setup();
    // Spanish is still schemaVersion 1, so it is the pack the legacy shell serves.
    const { pack, events } = spanishWithHistory();
    render(<CourseWorkspace environment={environment({ events })} />);

    const lesson = pack.lessons.find((candidate) => candidate.id === "es-cafe-requests-foundation")!;
    const button = await screen.findByRole("button", { name: lesson.title });
    expect(button, "the Spanish café lesson is not unlocked by the earlier history").toBeEnabled();
    await user.click(button);

    const scene = sceneOnScreen();
    expect(scene, "the Spanish café lesson renders no scene").not.toBeNull();
    expect(scene!.getAttribute("src")).toBe("/images/scenes/ordering-coffee.jpg");
    expect(scene!.getAttribute("alt")).toBe("");
    // The legacy intro is the long one: the heading, the aim line and "Begin
    // practice" are all still there, with the picture added above them.
    expect(screen.getByRole("heading", { name: lesson.title })).toBeVisible();
    expect(screen.getByText("Your aim:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Begin practice" })).toBeVisible();
  });
});
