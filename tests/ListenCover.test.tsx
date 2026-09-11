// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListenPlayer } from "@/components/listen/ListenPlayer";
import { tracksForCourse } from "@/features/listen/tracks";
import { bannerArtwork, bannerFor, BANNER_SOURCE } from "@/features/course-pack/banners";
import { PLAYER_SQUARE } from "@/features/listen/player-art";
import { imageDimensions } from "./helpers/image-size";
import { join } from "node:path";

/**
 * Lock-screen artwork for the audio lessons.
 *
 * `navigator.mediaSession.metadata` is what a phone shows while the screen is
 * off, which for an eleven-minute walk-friendly track is most of the time it is
 * playing. The metadata was set with a title, an artist and an album and **no
 * artwork**, so the lock screen — the one surface a learner looks at without
 * touching the phone — showed a generic placeholder.
 *
 * The artwork leads with the player's own square illustration — drawn for this
 * slot, and what the platform picks for a notification or a small square lock
 * screen — and keeps the course banner behind it, so a wider surface still
 * identifies the course the way the course page does. Both are cached offline
 * (the service worker precaches each) and embedded in the portable file, and
 * both go through the edition's media resolver: a path handed to the portable
 * single file is a path it cannot fetch.
 */

type Captured = { title?: string; artist?: string; album?: string; artwork?: { src: string; sizes: string; type: string }[] };

let captured: Captured | null = null;

beforeEach(() => {
  captured = null;
  class FakeMediaMetadata {
    constructor(init: Captured) {
      // Copy the fields onto the instance so the captured object exposes them
      // the way a real MediaMetadata does.
      Object.assign(this, init);
    }
  }
  vi.stubGlobal("MediaMetadata", FakeMediaMetadata);
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: {
      set metadata(value: Captured | null) {
        captured = value;
      },
      get metadata() {
        return captured;
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "mediaSession");
});

// A real track from the generated catalog, so the fixture cannot drift from the
// shape the editions actually pass in.
const track = tracksForCourse("french")[0];

const renderPlayer = (coverUrl?: string, resolveMedia?: (url: string) => string) =>
  render(
    <ListenPlayer
      track={track}
      courseTitle="French foundations"
      lessonTitle={track.lessonTitle}
      coverUrl={coverUrl}
      resolveMedia={resolveMedia}
    />,
  );

describe("the audio lesson's lock-screen metadata", () => {
  it("names the track and the course", () => {
    renderPlayer(bannerFor("french"));
    expect(captured).toMatchObject({
      title: `${track.lessonTitle} · audio lesson`,
      artist: "VerbaLibera",
      album: "French foundations",
    });
  });

  it("leads with the player's own square, then the course banner, each at its real size", () => {
    renderPlayer(bannerFor("french"));
    const artwork = captured?.artwork ?? [];
    expect(artwork).toHaveLength(2);
    expect(artwork[0].src).toBe("/brand/player-lock.jpg");
    expect(artwork[1].src).toBe("/brand/courses/french.jpg");
    expect(artwork.every((entry) => entry.type === "image/jpeg")).toBe(true);
    // The declared size is what the platform uses to pick artwork, so it has to
    // be the file's real size rather than a round number — checked against the
    // files on disk, not against the constants the module exports.
    const square = imageDimensions(join(process.cwd(), "public/brand/player-lock.jpg"))!;
    const banner = imageDimensions(join(process.cwd(), "public/brand/courses/french.jpg"))!;
    expect(artwork[0].sizes).toBe(`${square.width}x${square.height}`);
    expect(artwork[0].sizes).toBe(`${PLAYER_SQUARE.width}x${PLAYER_SQUARE.height}`);
    expect(artwork[1].sizes).toBe(`${banner.width}x${banner.height}`);
    expect(artwork[1].sizes).toBe(`${BANNER_SOURCE.width}x${BANNER_SOURCE.height}`);
  });

  it("hands the portable edition embedded blobs, not paths it cannot fetch", () => {
    // The library resolves the course banner before the player sees it; the
    // square is the URL this component has to put through the resolver itself.
    renderPlayer("blob:portable-cover", (url) =>
      url === "/brand/player-lock.jpg" ? "blob:portable-lock" : url,
    );
    const artwork = captured?.artwork ?? [];
    expect(artwork[0].src).toBe("blob:portable-lock");
    expect(artwork[1].src).toBe("blob:portable-cover");
  });

  it("still sets the player's own artwork when the course has no banner", () => {
    // A course without a banner, or an edition that could not resolve it: the
    // metadata used to omit artwork entirely. It now always has the player's own
    // square, which ships with the app, so the lock screen is never generic —
    // and no course path is invented to fill the gap.
    renderPlayer(undefined);
    const artwork = captured?.artwork ?? [];
    expect(artwork).toHaveLength(1);
    expect(artwork[0].src).toBe("/brand/player-lock.jpg");
    expect(artwork.map((entry) => entry.src)).not.toContain("/brand/courses/french.jpg");
    expect(bannerArtwork("/brand/courses/french.jpg")[0].sizes).toContain("x");
  });

  it("still renders the player when the browser has no Media Session API", () => {
    // Older browsers, and jsdom without the stub: the card is the product, the
    // lock screen is a bonus.
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "mediaSession");
    renderPlayer(bannerFor("french"));
    expect(screen.getByRole("button", { name: /play/i })).toBeVisible();
    expect(captured).toBeNull();
  });
});
