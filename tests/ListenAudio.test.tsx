import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LISTEN_TRACKS } from "@/features/listen/tracks";
import { listenedAt, markListened } from "@/features/listen/listened";
import { ListenPlayer } from "@/components/listen/ListenPlayer";
import marketSections from "@/features/listen/generated/italian.json";

describe("listen tracks", () => {
  it.each(["spanish", "portuguese", "german"])("%s has a long recording built from its displayed script", (language) => {
    const track = LISTEN_TRACKS.find((item) => item.courseSlug === language);
    expect(track).toBeDefined();
    const scriptPath = `services/voice/scripts/${language}-introductions-listen.lesson.json`;
    const script = JSON.parse(readFileSync(scriptPath, "utf8"));
    const provenance = JSON.parse(readFileSync(`docs/audio-provenance/${language}-introductions-listen.json`, "utf8"));
    expect(track!.sections).toEqual(script.sections);
    expect(track!.durationS).toBeGreaterThanOrEqual(480);
    expect(track!.durationS).toBeLessThan(900);
    expect(createHash("sha256").update(readFileSync(`public${track!.audioUrl}`)).digest("hex")).toBe(provenance.audio_sha256);
    expect(createHash("sha256").update(readFileSync(scriptPath)).digest("hex")).toBe(provenance.source_sha256);
    const pack = JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8"));
    expect(pack.lessons.some((lesson: { id: string }) => lesson.id === track!.lessonId)).toBe(true);
  });
  it("Italian read-along includes every authored spoken turn in order", () => {
    const track = LISTEN_TRACKS.find((item) => item.lessonId === "it-market-foundation")!;
    const displayed = track.sections.flatMap((section) => [section.teacher, section.target?.text ?? ""]).filter(Boolean).join(" ");
    expect(displayed).toBe(
      marketSections
        .flatMap((section) => [section.teacher, section.target?.text ?? ""])
        .filter(Boolean)
        .join(" "),
    );
  });
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
    expect(screen.getByRole("link", { name: "Save audio for offline listening" })).toHaveAttribute("href", track.audioUrl);
    expect(
      screen.getByLabelText(`Play the audio lesson: ${track.lessonTitle}`),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByText(/read along/i));
    expect(screen.getByText(/think: marc/i)).toBeInTheDocument();
  });
});
