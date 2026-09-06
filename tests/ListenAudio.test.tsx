import { existsSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LISTEN_TRACKS } from "@/features/listen/tracks";
import { listenedAt, markListened } from "@/features/listen/listened";
import { ListenPlayer } from "@/components/listen/ListenPlayer";

describe("listen tracks", () => {
  it("every registered track ships a real audio file and a transcript", () => {
    // Break caught: a track entry points at audio that was never authored.
    expect(LISTEN_TRACKS.length).toBeGreaterThan(0);
    for (const track of LISTEN_TRACKS) {
      expect(existsSync(`public${track.audioUrl}`)).toBe(true);
      expect(track.sections.length).toBeGreaterThan(0);
      expect(
        track.sections.every((s) => s.teacher.trim().length > 0),
      ).toBe(true);
    }
  });
});

const listenStore = new Map<string, string>();
beforeEach(() => {
  listenStore.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => listenStore.get(key) ?? null,
    setItem: (key: string, value: string) => void listenStore.set(key, value),
    removeItem: (key: string) => void listenStore.delete(key),
  });
});

describe("listened log", () => {

  it("records heard timestamps without claiming mastery", () => {
    expect(listenedAt("fr-identity-foundation")).toBeNull();
    const iso = markListened("fr-identity-foundation");
    expect(listenedAt("fr-identity-foundation")).toBe(iso);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("ListenPlayer", () => {
  it("renders the player, transcript and heard state", async () => {
    const user = userEvent.setup();
    const track = LISTEN_TRACKS[0];
    render(<ListenPlayer track={track} courseTitle="French foundations" />);
    expect(
      screen.getByLabelText(`Play the audio lesson: ${track.lessonTitle}`),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByText(/read along/i));
    expect(screen.getByText(/think: marc/i)).toBeInTheDocument();
  });
});
