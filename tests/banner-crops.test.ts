// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import catalog from "@/features/course-pack/catalog.json";
import { BANNER_FULL_ASPECT, bannerFor, bannerStyle } from "@/features/course-pack/banners";

/**
 * The narrow-viewport banner crop, checked the way the browser applies it.
 *
 * Each course banner is 2064x512 and the drawing inside it is narrower than the
 * frame. Rendered at the width of a phone the whole 4:1 picture is an ~85px
 * strip and the drawing is illegible — worst on German, whose artwork fills 64%
 * of the frame and starts a third of the way in, after the approved re-framing
 * put the scene's left margin back.
 *
 * `scripts/brand/banner-crops.py` measures the artwork and writes
 * `banner-crops.json`; this file re-derives the visible window from that data and
 * fails if any artwork would fall outside it. Nothing here needs Pillow: the
 * script is where the pixels are read, and it can be re-run as a check when
 * Python is present.
 */

type Crop = {
  source: { width: number; height: number };
  art: { x: number; y: number; width: number; height: number };
  cropAspect: number;
  focusX: number;
};

const crops = JSON.parse(
  readFileSync(join(process.cwd(), "src/features/course-pack/banner-crops.json"), "utf8"),
) as { courses: Record<string, Crop>; fullAspect: number };

const slugs = catalog.map((entry) => entry.slug).sort();

/**
 * The visible source window for a crop, as fractions of the frame.
 *
 * `object-position: X%` aligns X% of the image with X% of the box, and with
 * `object-fit: cover` on a box shorter than the frame the sides are cut — so the
 * window's left edge lands at `X/100 * (1 - window width)`.
 */
function windowFor(crop: Crop, aspect = crop.cropAspect) {
  const frameAspect = crop.source.width / crop.source.height;
  const width = aspect / frameAspect;
  const left = (crop.focusX / 100) * (1 - width);
  return { left, right: left + width, width };
}

/** Rendered height for a container width, at a given aspect ratio. */
const heightAt = (containerWidth: number, aspect: number) => containerWidth / aspect;

describe("the course banner's narrow crop", () => {
  it("has a measured window for every catalogued course", () => {
    expect(Object.keys(crops.courses).sort()).toEqual(slugs);
    expect(crops.fullAspect).toBeCloseTo(BANNER_FULL_ASPECT, 2);
  });

  it.each(slugs)("%s: the window holds the whole artwork", (slug) => {
    const crop = crops.courses[slug];
    const window = windowFor(crop);
    // Fractions, so this is independent of the source's pixel size.
    expect(window.left, `${slug}: window starts before the artwork`).toBeLessThanOrEqual(
      crop.art.x + 0.005,
    );
    expect(
      window.right,
      `${slug}: window ends before the artwork does`,
    ).toBeGreaterThanOrEqual(crop.art.x + crop.art.width - 0.005);
  });

  it.each(slugs)("%s: the window is the artwork plus breathing room, not a crop", (slug) => {
    const crop = crops.courses[slug];
    const window = windowFor(crop);
    const artShare = crop.art.width / window.width;
    // 1/1.06 breathing room reads as ~94%. A window much wider than the art is
    // wasted space; much narrower means the artwork is being cut.
    expect(artShare, `${slug}: art fills ${(artShare * 100).toFixed(0)}% of its window`).toBeGreaterThan(0.9);
    expect(artShare).toBeLessThan(0.97);
  });

  it("makes the drawing meaningfully larger on a phone, most of all for German", () => {
    // A 320px viewport leaves 280px of column (`.study` pads clamp(20px, 5vw, 64px)).
    const column = 280;
    const growth = (slug: string) => {
      const crop = crops.courses[slug];
      const window = windowFor(crop);
      // The artwork's share of the frame before the crop, versus its share of
      // the window after it: how much bigger the drawing renders.
      return window.width < 1 ? 1 / window.width : 1;
    };
    for (const slug of slugs)
      expect(growth(slug), `${slug} renders no larger than the full frame`).toBeGreaterThanOrEqual(1.15);
    // German is the banner the brief flags and the one this crop buys the most:
    // its artwork is 64% of the frame with a wide empty margin to its left.
    // Measured against the other courses rather than against a fixed number, so
    // the assertion follows the artwork — the approved re-framing moved this
    // from x1.69 to x1.47, and the ordering is what actually matters.
    for (const slug of slugs.filter((slug) => slug !== "german"))
      expect(growth("german"), `${slug} grows more than German`).toBeGreaterThan(growth(slug));
    // And the numbers behind it: the band stays legible on the narrowest phone.
    const germanHeight = heightAt(column, crops.courses.german.cropAspect);
    expect(germanHeight).toBeGreaterThan(heightAt(column, crops.fullAspect) * 1.4);
    expect(germanHeight, "the German band is still a strip on a small phone").toBeGreaterThan(100);
  });

  it("would fail if the crop were the identity, which is what shipped before", () => {
    // Non-vacuity: with the window set back to the full frame — the state every
    // banner was in — the German assertion above fails.
    const identity = { ...crops.courses.german, cropAspect: crops.fullAspect, focusX: 50 };
    const window = windowFor(identity);
    expect(window.width).toBeCloseTo(1, 3);
    expect(1 / window.width).toBeLessThan(1.15);
  });

  it("is a crop only below the 768px breakpoint", () => {
    // Above it the shell keeps the full frame: the desktop banner is already
    // legible and reapportioning it would be an art-direction change nobody asked
    // for.
    const css = readFileSync(
      join(process.cwd(), "src/features/course-pack/study.css"),
      "utf8",
    );
    const mobileBlock = css.slice(css.indexOf("@media (max-width: 767px)"));
    expect(mobileBlock).toMatch(/\.course-banner\s*\{[\s\S]*?aspect-ratio:\s*var\(--banner-crop/);
    const beforeBreakpoint = css.slice(0, css.indexOf("@media (max-width: 767px)"));
    expect(beforeBreakpoint).toMatch(/aspect-ratio:\s*var\(--banner-full/);
    expect(beforeBreakpoint).not.toMatch(/aspect-ratio:\s*var\(--banner-crop/);
  });

  it("hands each shell the crop as custom properties, and nothing for an unknown course", () => {
    for (const slug of slugs) {
      const crop = crops.courses[slug];
      expect(bannerStyle(slug), slug).toMatchObject({
        "--banner-crop": String(crop.cropAspect),
        "--banner-focus": `${crop.focusX}%`,
      });
    }
    // A course with no measurement keeps the stylesheet's defaults rather than
    // inheriting another course's window.
    expect(bannerStyle("klingon")).toEqual({});
    expect(bannerFor("klingon")).toBeUndefined();
    for (const slug of slugs) expect(bannerFor(slug)).toBe(`/brand/courses/${slug}.jpg`);
  });

  it("matches a fresh measurement of the artwork when Python is available", () => {
    // The pixel truth lives in the script; this keeps the committed numbers tied
    // to it. Skipped with the reason where Pillow is absent, which is most CI
    // runners — the assertions above still run everywhere.
    const script = join(process.cwd(), "scripts/brand/banner-crops.py");
    if (!existsSync(script)) throw new Error("scripts/brand/banner-crops.py is missing");
    let available = true;
    try {
      execFileSync("python3", ["-c", "import PIL"], { stdio: "ignore" });
    } catch {
      available = false;
    }
    if (!available) {
      console.warn(
        "skipped: no python3 + Pillow here, so banner-crops.json is not re-measured from the JPEGs",
      );
      return;
    }
    const output = execFileSync("python3", [script, "--check"], { encoding: "utf8" });
    expect(output).toContain("matches a fresh measurement");
  });
});
