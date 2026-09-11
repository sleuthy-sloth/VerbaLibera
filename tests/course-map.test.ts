// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { COURSE_MAP } from "@/features/course-pack/course-map";
import { imageDimensions } from "./helpers/image-size";

/**
 * The course map, and the surface that shows it.
 *
 * The app's progress surfaces are lists — the daily path, the course path, the weekly
 * checklist on `/learn/<course>/plan`. The plan page is the one that describes a route
 * through the course, so that is where the picture went, and this pins the two halves
 * that could drift apart: the file at the size the component declares, and the
 * component actually pointing at the file. The render itself is asserted in
 * `tests/e2e/study-plan-account.spec.ts`, which opens the page as a guest.
 */

const ROOT = process.cwd();
const PLAN_SECTION = join(ROOT, "src/components/plan/PlanSection.tsx");
const MAP_FILE = join(ROOT, "public/images/course-map.jpg");

describe("the course map", () => {
  it("ships the file the constant describes, at its own frame", () => {
    const size = imageDimensions(MAP_FILE)!;
    expect([size.width, size.height]).toEqual([COURSE_MAP.width, COURSE_MAP.height]);
    expect(COURSE_MAP.url).toBe("/images/course-map.jpg");
    expect(COURSE_MAP.label.length, "the map has no description").toBeGreaterThan(20);
    // 1.49:1 — deliberately not the 4:3 of the lesson scenes, because cropping the
    // route to that shape would cut the stops off its ends.
    expect(size.width / size.height).toBeGreaterThan(1.4);
  });

  it("is declared and rendered by the plan page, not just available to it", () => {
    const source = readFileSync(PLAN_SECTION, "utf8");
    expect(source, "the plan page does not import the map").toContain(
      "@/features/course-pack/course-map",
    );
    // Declared at the file's own size, so the row reserves its space before the
    // picture arrives, and decorative, because the heading above it names the course.
    expect(source).toContain("src={COURSE_MAP.url}");
    expect(source).toContain("width={COURSE_MAP.width}");
    expect(source).toContain("height={COURSE_MAP.height}");
    expect(source).toMatch(/alt=""/);
  });
});
