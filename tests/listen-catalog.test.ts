import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { listenCatalogEntries, formatBytes, listenAssetsFor, listenBytesFor } from "@/features/listen/catalog";
import { LISTEN_TRACKS, tracksForCourse } from "@/features/listen/tracks";
import { buildListenCatalog, listenCatalogMismatches } from "../scripts/content/listen";

const committed = JSON.parse(
  readFileSync("src/features/listen/catalog.json", "utf8"),
) as ReturnType<typeof buildListenCatalog>;

describe("the shipped long-form audio is measured, not remembered", () => {
  it("ships one measured track for every advertised audio lesson", () => {
    // The app advertises a track per course; if a course has a track, it must
    // be in the catalog, or the download flow will not cache it and the offline
    // edition cannot play it.
    const advertised = new Set(LISTEN_TRACKS.map((track) => track.audioUrl));
    expect(new Set(committed.entries.map((entry) => entry.audioUrl))).toEqual(advertised);
    expect(committed.entries.length).toBe(LISTEN_TRACKS.length);
    expect(listenCatalogEntries.length).toBe(LISTEN_TRACKS.length);
  });

  it("agrees with the files on disk", () => {
    // Recomputes every digest and size from the mp3s. A re-recorded or
    // truncated track fails here rather than shipping a stale number.
    expect(listenCatalogMismatches(committed)).toEqual([]);
  });

  it("reports real sizes, so 'about 5 MB' is a measurement", () => {
    const french = committed.entries.find((entry) => entry.courseSlug === "french")!;
    expect(french.bytes).toBeGreaterThan(4_000_000);
    expect(listenBytesFor("french")).toBe(french.bytes);
    expect(formatBytes(french.bytes)).toMatch(/^\d+\.\d MB$/);
    // Every track is measured, not defaulted to zero.
    expect(committed.entries.every((entry) => entry.bytes > 1_000_000)).toBe(true);
  });

  it("hands the download flow a digest to verify, not just a path", () => {
    const assets = listenAssetsFor("french");
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.url).toMatch(/^\/audio\//);
    }
    // No track from another course leaks into a course's download.
    expect(assets.every((asset) => asset.url.includes("french-foundations"))).toBe(true);
    expect(listenAssetsFor("klingon")).toEqual([]);
  });

  it("counts the same tracks the Listen view lists", () => {
    for (const track of LISTEN_TRACKS) {
      const listed = tracksForCourse(track.courseSlug);
      expect(listed.some((candidate) => candidate.lessonId === track.lessonId)).toBe(true);
      expect(
        committed.entries.find((entry) => entry.lessonId === track.lessonId),
      ).toBeDefined();
    }
  });
});

describe("the stale-catalog detector can fail", () => {
  it("notices a size that no longer matches the file", () => {
    const doctored = structuredClone(committed);
    doctored.entries[0].bytes += 1;
    expect(listenCatalogMismatches(doctored)).toEqual([
      expect.stringContaining("catalog says"),
    ]);
  });

  it("notices a digest that no longer matches the file", () => {
    const doctored = structuredClone(committed);
    doctored.entries[0].sha256 = "0".repeat(64);
    expect(listenCatalogMismatches(doctored)).toEqual([
      expect.stringContaining("digest does not match"),
    ]);
  });

  it("notices a catalogued track that is not shipped", () => {
    const doctored = structuredClone(committed);
    doctored.entries.push({
      lessonId: "fr-ghost-foundation",
      courseSlug: "french",
      audioUrl: "/audio/french-foundations/fr-ghost-listen.mp3",
      bytes: 1,
      sha256: "1".repeat(64),
    });
    expect(listenCatalogMismatches(doctored).join("\n")).toMatch(/catalogued but not shipped/);
  });
});
