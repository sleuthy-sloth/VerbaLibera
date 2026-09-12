import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { RuntimeCourseWorkspace } from "@/features/course-pack/RuntimeCourseWorkspace";
import { createMemoryLessonPractice, type CourseEnvironment } from "@/features/course-pack/environment";
import { normalizePack } from "@/features/course-pack/normalize-pack";
import type { RuntimePack } from "@/features/course-pack/lesson-runtime";

/**
 * The v2 shell's dialogue surface.
 *
 * `DialogueView` existed and worked, and was rendered by the legacy shell only —
 * so once a course migrated to v2 its scripted conversations became unreachable
 * through the UI. French and Italian each ship two of them; German, Portuguese
 * and Spanish ship none, which is what makes the guard testable rather than
 * hypothetical.
 */

const pack = (language: string): RuntimePack =>
  normalizePack(JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8")));

function environment(): CourseEnvironment {
  return {
    capabilities: { accounts: false, synchronization: false, offlineInstall: false, hostedNavigation: false },
    practice: {
      getDurability: () => "temporary",
      subscribeDurability: () => () => {},
      read: async () => [],
      write: async () => {},
    },
    lessonPractice: createMemoryLessonPractice(),
    loadPack: vi.fn(),
    loadCourse: async () => pack("french"),
    resolveMedia: (url) => url,
  };
}

const renderCourse = (language: string) =>
  render(
    <RuntimeCourseWorkspace
      pack={pack(language)}
      environment={environment()}
      scope={null}
      language={language}
      onLanguageChange={() => {}}
      onProgressChanged={() => {}}
    />,
  );

const dialoguesSection = async () =>
  within(await screen.findByRole("region", { name: "Use it in a conversation" }));

describe("the v2 course shell's dialogues", () => {
  it("shows every authored dialogue, with the lesson to study first", async () => {
    const french = pack("french");
    renderCourse("french");
    const section = await dialoguesSection();

    expect(french.dialogues).toHaveLength(2);
    for (const dialogue of french.dialogues) {
      expect(section.getByRole("heading", { name: dialogue.title })).toBeVisible();
      expect(section.getByText(dialogue.goal)).toBeVisible();
      const lesson = french.lessons.find((l) => l.id === dialogue.prerequisite)!;
      // The prerequisite is named, not enforced: the learner reads which lesson
      // the conversation assumes. Matched on the element's own text, because the
      // sentence is a text node plus an expression and the title carries a `?`.
      expect(
        section.getByText(
          (_, element) =>
            element?.tagName === "P" &&
            element.textContent === `Study first: ${lesson.title}`,
        ),
      ).toBeVisible();
    }
    // Somewhere on the page, the recovery branch is reachable — the thing that
    // makes these conversations worth having.
    expect(section.getAllByRole("button", { name: /Je suis/ }).length).toBeGreaterThan(0);
  });

  it("plays a dialogue: a branch advances the line, and the goal ends it", async () => {
    const french = pack("french");
    renderCourse("french");
    const section = await dialoguesSection();
    const meeting = french.dialogues.find((d) => d.id === "fr-meeting")!;
    const start = meeting.nodes.find((n) => n.id === meeting.start)!;
    // Scope to the dialogue's own article, because the other one renders too.
    const article = within(
      section.getByRole("heading", { name: meeting.title }).closest("article") as HTMLElement,
    );

    expect(article.getByText(start.line)).toBeVisible();
    // Walk the authored branch until the goal node, asserting each line as it
    // arrives: the graph is greeting → welcome, and the second node is terminal.
    let node = start;
    for (let step = 0; step < 6 && !node.complete; step += 1) {
      const choice = node.choices[0];
      await userEvent.click(article.getByRole("button", { name: choice.text }));
      node = meeting.nodes.find((n) => n.id === choice.next)!;
      expect(await article.findByText(node.line)).toBeVisible();
    }
    expect(node.complete, "the walk reached the goal").toBe(true);

    // The terminal node says so and offers the conversation again.
    expect(await article.findByText("Conversation complete. You reached the goal.")).toBeVisible();
    await userEvent.click(article.getByRole("button", { name: "Try the conversation again" }));
    expect(await article.findByText(start.line)).toBeVisible();
  });

  it("renders nothing at all for a course that authors no dialogues", async () => {
    // German is v2 like French and ships no conversations. Without the content
    // guard the section would render an empty heading for it.
    const german = pack("german");
    expect(german.dialogues).toHaveLength(0);
    renderCourse("german");
    await screen.findByRole("navigation", { name: "Course path" });
    expect(screen.queryByRole("region", { name: "Use it in a conversation" })).toBeNull();
    expect(screen.queryByText(/Original scripted conversations/)).toBeNull();
  });

  it("keeps every authored dialogue's prerequisite pointing at a real lesson", async () => {
    // Non-vacuity for the label above: a dialogue whose prerequisite id did not
    // resolve would render the vague fallback and read as content, not as the
    // broken link it is.
    for (const language of ["french", "italian"]) {
      const host = pack(language);
      expect(host.dialogues.length, `${language} authors dialogues`).toBeGreaterThan(0);
      for (const dialogue of host.dialogues) {
        const lesson = host.lessons.find((l) => l.id === dialogue.prerequisite);
        expect(lesson, `${language}/${dialogue.id} prerequisite ${dialogue.prerequisite}`).toBeDefined();
      }
    }
  });
});
