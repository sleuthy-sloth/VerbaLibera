// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListenPlayer } from "@/components/listen/ListenPlayer";
import { tracksForCourse } from "@/features/listen/tracks";
import { bannerArtwork, bannerFor, BANNER_SOURCE } from "@/features/course-pack/banners";
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
 * The artwork is the course banner, so the lock screen identifies the course the
 * same way the course page does, and it is already cached offline (the service
 * worker precaches every banner) and embedded in the portable file.
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

const renderPlayer = (coverUrl?: string) =>
  render(
    <ListenPlayer
      track={track}
      courseTitle="French foundations"
      lessonTitle={track.lessonTitle}
      coverUrl={coverUrl}
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

  it("carries the course banner, declared at the file's own size", () => {
    renderPlayer(bannerFor("french"));
    const artwork = captured?.artwork ?? [];
    expect(artwork).toHaveLength(1);
    expect(artwork[0].src).toBe("/brand/courses/french.jpg");
    expect(artwork[0].type).toBe("image/jpeg");
    // The declared size is what the platform uses to pick artwork, so it has to
    // be the file's real size rather than a round number.
    const file = imageDimensions(join(process.cwd(), "public/brand/courses/french.jpg"))!;
    expect(artwork[0].sizes).toBe(`${file.width}x${file.height}`);
    expect(artwork[0].sizes).toBe(`${BANNER_SOURCE.width}x${BANNER_SOURCE.height}`);
  });

  it("hands the portable edition its embedded blob, not a path it cannot fetch", () => {
    renderPlayer("blob:portable-cover");
    expect(captured?.artwork?.[0].src).toBe("blob:portable-cover");
  });

  it("sets no artwork rather than a broken one when the edition has no cover", () => {
    // A course without a banner, or an edition that could not resolve it: the
    // metadata must omit the field. A `src` that 404s reads as a load failure on
    // some platforms instead of falling back to the text.
    renderPlayer(undefined);
    expect(captured).not.toBeNull();
    expect(captured).not.toHaveProperty("artwork");
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
