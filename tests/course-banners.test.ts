import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import catalog from "@/features/course-pack/catalog.json";
import { collectPortableContent } from "../scripts/portable/content";

/**
 * Course banner coverage.
 *
 * German shipped with `noArt: true` in `CourseShowcase.tsx` and `alt: ''` in
 * `src/app/courses/page.tsx` long after `public/brand/courses/german.jpg`
 * existed. Both surfaces gate the banner on those hand-maintained flags, so the
 * one course with no picture on the landing page and the course library was the
 * one whose picture had actually been generated — and the existing e2e loop
 * ("every image on the landing page loads") passed, because a card with no
 * image has no image to fail on.
 *
 * These assertions compare the two listings against the files on disk, in both
 * directions, so a language can no longer be added, renamed or given artwork
 * without every surface following.
 */

const ROOT = process.cwd();
const BANNER_DIR = path.join(ROOT, "public/brand/courses");
const LISTINGS = ["src/app/courses/page.tsx", "src/components/landing/CourseShowcase.tsx"];

const bannerFor = (slug: string): string => path.join(BANNER_DIR, `${slug}.jpg`);

const diskSlugs = (): string[] =>
  fs
    .readdirSync(BANNER_DIR)
    .filter((file) => file.endsWith(".jpg"))
    .map((file) => file.replace(/\.jpg$/, ""))
    .sort();

const catalogSlugs = (): string[] => catalog.map((entry) => entry.slug).sort();

const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), "utf8");

/**
 * Comments are stripped before the "forbidden shape" checks so a file is free to
 * name the defect it documents — the same rule `tests/design-tokens.test.ts`
 * follows, and the reason this file's own explanation of `noArt` does not trip
 * its own assertion.
 */
const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/[^\n]*/g, "");

/** `slug: 'german'` entries in a listing file, in source order. */
const listedSlugs = (relative: string): string[] =>
  [...read(relative).matchAll(/slug:\s*'([^']+)'/g)].map((match) => match[1]);

describe("course banners", () => {
  it("has a banner file for every catalogued language", () => {
    for (const slug of catalogSlugs())
      expect(fs.existsSync(bannerFor(slug)), `missing public/brand/courses/${slug}.jpg`).toBe(true);
  });

  it("has no banner file for a language that is not catalogued", () => {
    // A leftover asset is how a stale slug keeps rendering somewhere.
    expect(diskSlugs().filter((slug) => !catalogSlugs().includes(slug))).toEqual([]);
  });

  it.each(LISTINGS)("%s lists every catalogued language exactly once", (listing) => {
    const listed = listedSlugs(listing);
    expect([...listed].sort()).toEqual(catalogSlugs());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it.each(LISTINGS)("%s renders a banner for every listed language", (listing) => {
    const source = withoutComments(read(listing));
    // No hand-maintained "this one has no art" flag, and no empty alt text:
    // both are the shape the German defect took on each surface.
    expect(source, "a listing still marks a course as artless").not.toMatch(/noArt/);
    expect(source, "a listing has an empty alt for a banner").not.toMatch(/alt:\s*''/);
    // Every entry carries alt text, so the `alt ?` gate in the course library
    // and the `alt` attribute in the showcase both resolve to a real banner.
    // Entries are sliced apart on `slug:` because one surface writes a field per
    // line and the other writes one object per line.
    const entries = source.split("slug: '").slice(1);
    for (const slug of listedSlugs(listing)) {
      const entry = entries.find((candidate) => candidate.startsWith(`${slug}'`));
      expect(entry, `${listing} has no entry for ${slug}`).toBeDefined();
      expect(entry, `${slug} has no alt text in ${listing}`).toMatch(/alt:\s*'[^']+'/);
    }
  });

  it("resolves a lesson-view banner for every catalogued language", () => {
    // `CourseWorkspace` has its own hardcoded map whose consumer renders null
    // for an unknown language, so a new course silently gets artwork everywhere
    // except inside the lesson.
    const workspace = read("src/features/course-pack/CourseWorkspace.tsx");
    const mapped = [...workspace.matchAll(/(\w+):\s*"\/brand\/courses\/([\w-]+)\.jpg"/g)].map(
      (match) => match[2],
    );
    expect([...mapped].sort()).toEqual(catalogSlugs());
    for (const slug of mapped)
      expect(fs.existsSync(bannerFor(slug)), `lesson banner ${slug}.jpg is missing`).toBe(true);
  });

  it("embeds a banner for every catalogued language in the offline bundle", () => {
    // The portable edition is one HTML file under `img-src blob: data:`, so a
    // banner the collector does not embed cannot load at all — no broken-image
    // icon, no request, just an empty frame. The collector used to hand-list four
    // paths and skipped missing files silently, so German was absent offline
    // while every other surface showed it.
    const { assets } = collectPortableContent(ROOT);
    for (const slug of catalogSlugs())
      expect(
        assets[`/brand/courses/${slug}.jpg`],
        `the offline bundle does not embed public/brand/courses/${slug}.jpg`,
      ).toBeDefined();
  });
});
