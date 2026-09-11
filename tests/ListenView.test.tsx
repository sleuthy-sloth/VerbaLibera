import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ListenView } from "@/components/listen/ListenView";
import { tracksForCourse } from "@/features/listen/tracks";

/**
 * One Listen surface for three editions (roadmap 3A).
 *
 * The hosted tab, the downloaded `/study.html` edition and the portable single
 * file render the same list, so the audio path is the same everywhere a learner
 * can be. These cases pin what each edition supplies differently: the pack that
 * provides lesson titles, whether the audio itself is present, and the honest
 * state when it is not. A row that cannot play must say so — a player that
 * fails silently is worse than no player.
 */

const frenchTracks = tracksForCourse("french");
const firstTrack = frenchTracks[0];

function lessonsFor(slug: string) {
  return [
    { id: firstTrack.lessonId, title: "First words" },
    { id: "fr-second-lesson", title: "Numbers" },
    { id: "fr-third-lesson", title: "Family" },
  ];
}

describe("ListenView", () => {
  it("lists a course's tracks under the lesson titles the learner saw", async () => {
    render(
      <ListenView
        courseSlug="french"
        courseTitle="French foundations"
        readCourse={async () => ({ lessons: lessonsFor("french") })}
      />,
    );
    // The track's own internal label is not used; the pack's lesson title is.
    expect(await screen.findByRole("button", { name: /First words/ })).toBeTruthy();
    expect(screen.queryByText(/Identity foundations/)).toBeNull();
    // Two of the three lessons have no recording yet, and that is said once.
    expect(screen.getByText(/2 more lessons are being recorded/)).toBeTruthy();
  });

  it("opens the player for the track that was chosen", async () => {
    render(
      <ListenView
        courseSlug="french"
        courseTitle="French foundations"
        readCourse={async () => ({ lessons: lessonsFor("french") })}
      />,
    );
    const row = await screen.findByRole("button", { name: /First words/ });
    await userEvent.click(row);
    expect(await screen.findByLabelText(/Audio lesson/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /All audio lessons/ })).toBeTruthy();
  });

  it("says why a track cannot play instead of rendering a dead player", async () => {
    render(
      <ListenView
        courseSlug="french"
        courseTitle="French foundations"
        readCourse={async () => ({ lessons: lessonsFor("french") })}
        unavailableFor={() => "Not in this file — it was built without the audio lessons."}
      />,
    );
    const row = await screen.findByRole("button", { name: /First words/ });
    await userEvent.click(row);
    await waitFor(() =>
      expect(screen.getByText(/built without the audio lessons/)).toBeTruthy(),
    );
    expect(screen.queryByLabelText(/Audio lesson/)).toBeNull();
  });

  it("says a course has no recording yet rather than showing an empty list", async () => {
    render(
      <ListenView
        courseSlug="klingon"
        courseTitle="Klingon foundations"
        readCourse={async () => ({ lessons: [{ id: "kl-first", title: "First words" }] })}
      />,
    );
    expect(await screen.findByText(/has no recorded lesson yet/)).toBeTruthy();
  });

  it("reports a pack that cannot be opened, and offers no list", async () => {
    const readCourse = vi.fn(async () => {
      throw new Error("Course pack is not downloaded yet.");
    });
    render(
      <ListenView courseSlug="french" courseTitle="French foundations" readCourse={readCourse} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/not downloaded yet/);
    expect(screen.queryByRole("button", { name: /First words/ })).toBeNull();
  });

  it("loads the titles once, even when the caller passes a fresh function each render", async () => {
    // An inline `readCourse` prop must not restart the load: the ref in the view
    // is what keeps the effect keyed to the course.
    const reads: string[] = [];
    render(
      <ListenView
        courseSlug="french"
        courseTitle="French foundations"
        readCourse={async (slug) => {
          reads.push(slug);
          return { lessons: lessonsFor(slug) };
        }}
      />,
    );
    const row = await screen.findByRole("button", { name: /First words/ });
    await userEvent.click(row);
    await userEvent.click(screen.getByRole("button", { name: /All audio lessons/ }));
    await waitFor(() => expect(reads.length).toBe(1));
  });

  it("tells the learner what the audio costs, from the measured catalog", async () => {
    render(
      <ListenView
        courseSlug="french"
        courseTitle="French foundations"
        readCourse={async () => ({ lessons: lessonsFor("french") })}
      />,
    );
    expect(await screen.findByText(/4\.9 MB of audio/)).toBeTruthy();
  });
});
