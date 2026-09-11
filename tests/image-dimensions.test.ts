// @vitest-environment node

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { imageDimensions } from "./helpers/image-size";

/**
 * Declared image dimensions, and what is actually in `public/brand`.
 *
 * Two leftovers from `docs/design/graphics-brief.md`, both about graphics that
 * are wired but wrong rather than missing.
 *
 * **Declared dimensions.** `next/image` reserves layout space from the declared
 * `width`/`height`, so a declaration whose aspect ratio does not match the file
 * makes the page shift when the picture arrives. The brief recorded two —
 * `hero-banner.jpg` declared 1536x1024 (4:3) for a 1584x672 (2.36:1) file, and
 * `empty-journal.jpg` declared 1024x683 for a 1024x1024 one. Both were corrected
 * before the brief was re-read; this is the guard that keeps the class fixed. A
 * display size may legitimately be smaller than the file (a 1024px mark shown at
 * 32px), so the assertion is on the ratio, not the pixels.
 *
 * **`public/brand` is the shipped brand system.** It carried a 976KB icon source
 * from a different project (`voxlibre-app-icon-source.png`) that nothing but the
 * brief referenced. Every file there must now be referenced by the app, so a
 * stray from another project fails by name.
 */

const ROOT = process.cwd();

const sourceFiles = (): string[] => [
  ...execFileSync(
    "grep",
    ["-rl", "--include=*.tsx", "--include=*.ts", "-E", "src=[\"']/", "src"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n"),
  // Hand-written public HTML is served straight from the cache and reserves space
  // from its declared dimensions exactly like a JSX element does. The offline
  // page's state mark is the case that exists today.
  ...execFileSync("grep", ["-rl", "--include=*.html", "<img", "public"], { encoding: "utf8" })
    .trim()
    .split("\n"),
].filter(Boolean);

/** Each `<Image … />` / `<img … />` element as a string, tags only. */
function imageElements(source: string): string[] {
  return [...source.matchAll(/<(?:Image|img)\b[\s\S]*?(?:\/>|>)/g)].map((match) => match[0]);
}

/** The offline page carries no framework, so its images are plain HTML attributes. */
const isHtml = (path: string): boolean => path.endsWith(".html");

const attribute = (element: string, name: string): string | null =>
  element.match(new RegExp(`${name}=(?:["']([^"']+)["']|\\{([^}]+)\\})`))?.slice(1).find(Boolean) ??
  null;

type Declared = { file: string; url: string; declared: [number, number]; actual: [number, number] };

function declarations(): { declared: Declared[]; unresolvable: string[] } {
  const found: Declared[] = [];
  const unresolvable: string[] = [];
  for (const path of sourceFiles()) {
    const source = readFileSync(path, "utf8");
    for (const element of imageElements(source)) {
      const src = attribute(element, "src");
      const width = attribute(element, "width");
      const height = attribute(element, "height");
      if (!src?.startsWith("/") || !width || !height) continue;
      const onDisk = join(ROOT, "public", src.replace(/^\//, ""));
      const size = imageDimensions(onDisk);
      if (!size) {
        unresolvable.push(`${relative(ROOT, path)}: ${src}`);
        continue;
      }
      found.push({
        file: relative(ROOT, path),
        url: src,
        declared: [Number(width), Number(height)],
        actual: [size.width, size.height],
      });
      if (isHtml(path) && !src.startsWith("/"))
        unresolvable.push(`${relative(ROOT, path)}: ${src} is not a root-relative path`);
    }
  }
  return { declared: found, unresolvable };
}

describe("images next/image reserves space for", () => {
  it("declares the file's own aspect ratio, so nothing shifts on load", () => {
    const { declared, unresolvable } = declarations();
    // Guard against the scrape silently finding nothing to check.
    expect(declared.length, "no declared image dimensions were found").toBeGreaterThanOrEqual(6);
    // And that the plain-HTML half of the scrape really found the offline page's
    // mark, rather than silently scanning nothing.
    expect(
      declared.filter((item) => item.file.endsWith(".html")).map((item) => item.url),
      "the offline page's images are not being checked",
    ).toContain("/brand/empty-journal.jpg");
    expect(unresolvable, "a declared image is missing or in a format we cannot read").toEqual([]);

    for (const item of declared) {
      const [dw, dh] = item.declared;
      const [aw, ah] = item.actual;
      expect(
        Math.abs(dw / dh - aw / ah),
        `${item.file}: ${item.url} is declared ${dw}x${dh} (${(dw / dh).toFixed(2)}:1) but the file is ${aw}x${ah} (${(aw / ah).toFixed(2)}:1), which shifts the layout when it loads`,
      ).toBeLessThan(0.01);
    }
  });

  it("would fail on the mismatch the brief recorded", () => {
    // Non-vacuity: the exact pair the brief listed, checked the way the test above
    // checks it. `hero-banner.jpg` is 1584x672; 1536x1024 was the declaration.
    const actual = imageDimensions(join(ROOT, "public/brand/hero-banner.jpg"))!;
    expect([actual.width, actual.height]).toEqual([1584, 672]);
    expect(Math.abs(1536 / 1024 - actual.width / actual.height)).toBeGreaterThan(0.01);
  });

  it("keeps public/brand to files the app actually ships", () => {
    const referenced: string[] = execFileSync(
      "grep",
      ["-rl", "--include=*.ts", "--include=*.tsx", "--include=*.css", "--include=*.json", "brand/", "src", "public", "scripts"],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    const haystack = referenced.map((path) => readFileSync(path, "utf8")).join("\n");

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );

    const strays = walk(join(ROOT, "public/brand")).filter((path) => {
      const name = path.slice(path.indexOf("public/brand/") + "public/brand/".length);
      return !haystack.includes(name);
    });
    expect(
      strays.map((path) => `${relative(ROOT, path)} (${Math.round(statSync(path).size / 1024)}KB)`),
      "a file in public/brand is not referenced by the app",
    ).toEqual([]);
  });
});

/**
 * The vocabulary pictures the picture drill draws.
 *
 * Four of the twenty-two were replaced with the project's own approved
 * illustrations, supplied at 1280x714 and normalised to the contract the design
 * brief's generation template names: 16:9, 800x449. The drill renders them in a
 * 4:3 box with `object-fit: cover`, so a file that arrives at the wrong size is
 * silently cropped on every screen — measured in a browser, the approved
 * compositions survive that crop, but only because they were normalised first.
 */
describe("the vocabulary pictures", () => {
  const dir = join(ROOT, "public/images/vocab");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".jpg"))
    .sort();

  it("keeps every file inside the 800px generation contract", () => {
    expect(files.length, "no vocabulary pictures were found").toBe(22);
    for (const name of files) {
      const size = imageDimensions(join(dir, name));
      expect(size, `${name} cannot be read`).not.toBeUndefined();
      expect(size!.width, `${name} is wider than the 800px ceiling`).toBeLessThanOrEqual(800);
      expect(size!.height, `${name} is taller than the 800px ceiling`).toBeLessThanOrEqual(800);
    }
  });

  it("ships the vocabulary pictures at the 16:9 contract size", () => {
    for (const name of [
      "piggybank",
      "tea",
      "coffee",
      "table",
      "key",
      "bed",
      "suitcase",
      "ambulance",
      "police",
    ]) {
      const size = imageDimensions(join(dir, `${name}.jpg`))!;
      expect([size.width, size.height], `${name}.jpg is not 800x449`).toEqual([800, 449]);
    }
  });

  it("would not pass on a folder that had only ever held 16:9 files", () => {
    // Non-vacuity: the other pictures are 800x533, 600x800 and similar, so the
    // assertion above discriminates between files rather than restating a rule
    // the whole folder already follows — and the supplied sources' own 1280x714
    // does not match the contract either, which is what normalising fixes.
    const sizes = files.map((name) => {
      const size = imageDimensions(join(dir, name))!;
      return `${size.width}x${size.height}`;
    });
    expect(new Set(sizes).size, "every file in the folder is the same size").toBeGreaterThan(3);
    expect(sizes).toContain("800x533");
    expect(sizes).not.toContain("1280x714");
  });
});

/**
 * The lesson scenes.
 *
 * Six situation pictures at 800x600 — the frame the supplied art is drawn in, so
 * the lesson surfaces render them with `height: auto` and never crop or stretch.
 * `tests/scenes.test.ts` owns the mapping; this owns the files, including the rule
 * that the folder has no orphans: a picture no situation names is artwork nobody
 * can reach.
 */
describe("the lesson scenes", () => {
  const dir = join(ROOT, "public/images/scenes");

  it("are all 800x600, and all named by a situation", () => {
    const files = readdirSync(dir)
      .filter((name) => name.endsWith(".jpg"))
      .sort();
    expect(files.length, "no lesson scenes were found").toBe(6);
    for (const name of files) {
      const size = imageDimensions(join(dir, name))!;
      expect([size.width, size.height], `${name} is not 800x600`).toEqual([800, 600]);
    }
  });
});

/**
 * The course map.
 *
 * One picture for the plan page, and its size is its own: 800x537 is the frame it is
 * drawn in (1.49:1), against the 4:3 of the lesson scenes it shares a column with.
 * `tests/course-map.test.ts` owns the wiring; this owns the file.
 */
describe("the course map", () => {
  it("is 800x537, the frame it is drawn in", () => {
    const size = imageDimensions(join(ROOT, "public/images/course-map.jpg"))!;
    expect([size.width, size.height]).toEqual([800, 537]);
  });
});
