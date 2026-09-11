// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `docs/asset-provenance.md` against the tree.
 *
 * The brief requires provenance for every shipped asset, and the document had
 * drifted far enough to be worse than absent: it described
 * `public/brand/verbalibera-app-icon-source.png` and
 * `public/illustrations/daily-practice.png` — neither of which exists, and neither
 * of which is tracked — while the entire Warm Studio set (four brand images, five
 * course banners, the social card, three icons, the touch icon and the favicon)
 * appeared nowhere in it.
 *
 * This pins both directions: every tracked asset is named, and everything the
 * document names in `public/` is really there. The dimension and byte figures in
 * its table come from `scripts/brand/asset-table.py`, so the numbers are read
 * from the files rather than trusted.
 */

const ROOT = process.cwd();
const DOC = join(ROOT, "docs/asset-provenance.md");

const doc = readFileSync(DOC, "utf8");

const tracked = (pattern: string): string[] =>
  execFileSync("git", ["ls-files", pattern], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

/** Brand art, icons and metadata images: everything hand-placed, unlike packs. */
const shippedAssets = (): string[] => [
  ...tracked("public/brand"),
  ...tracked("public/icons"),
  "public/og-card.jpg",
  "public/apple-touch-icon.png",
  "src/app/favicon.ico",
];

describe("the asset provenance document", () => {
  it("names every shipped asset", () => {
    const missing = shippedAssets().filter((path) => !doc.includes(`\`${path}\``));
    expect(missing, "assets with no provenance entry").toEqual([]);
  });

  it("names nothing that is not in the tree", () => {
    // Paths the document presents as live files. The removed ones are named too,
    // but inside the "Removed files" section, which is checked separately below.
    const live = doc.slice(0, doc.indexOf("## Removed files"));
    const referenced = [...live.matchAll(/`(public\/[\w./-]+)`/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThan(10);
    const missing = [...new Set(referenced)].filter((path) => !existsSync(join(ROOT, path)));
    expect(missing, "the document describes files that do not exist").toEqual([]);
  });

  it("keeps the removed files in the removed section, so they are not re-added", () => {
    const removed = doc.slice(doc.indexOf("## Removed files"));
    expect(removed).toContain("public/brand/verbalibera-app-icon-source.png");
    expect(removed).toContain("public/illustrations/daily-practice.png");
    expect(removed).toContain("voxlibre-app-icon-source.png");
    // And the rest of the document no longer presents them as live.
    const live = doc.slice(0, doc.indexOf("## Removed files"));
    for (const gone of [
      "public/brand/verbalibera-app-icon-source.png",
      "public/illustrations/daily-practice.png",
    ])
      expect(live).not.toContain(`\`${gone}\``);
  });

  it("records the German banner's deviation from its approved reference", () => {
    // Measured, not asserted from memory: scripts/brand/compare-reference.py
    // reports the shipped file as the reference shifted ~278px, while the other
    // four course banners re-encode cleanly. The document has to say so, because
    // the alternative is somebody discovering it from a screenshot.
    const references = doc.slice(doc.indexOf("## Approved references"));
    expect(references).toContain("+278 px");
    expect(references).toContain("courses/german.jpg");
    for (const language of ["french", "italian", "spanish", "portuguese"])
      expect(references, `${language} is not in the comparison table`).toContain(
        `courses/${language}.jpg`,
      );
    // The re-frame's consequence is the part a future maintainer needs.
    expect(references).toMatch(/2\.39/);
    expect(references).toMatch(/2\.75/);
  });

  it("gives every shipped asset a dimension and a size", () => {
    const table = doc.slice(doc.indexOf("## What ships"), doc.indexOf("## Approved references"));
    const rows = [...table.matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(15);
    for (const [, path, dimensions, size] of rows) {
      expect(dimensions.trim(), `${path} has no dimensions`).toMatch(/^\d+×\d+$/);
      expect(size.trim(), `${path} has no byte size`).toMatch(/^[\d,]+ B$/);
    }
  });

  it("keeps the icon safe-zone measurement, which is why the maskable icon differs", () => {
    const icons = doc.slice(doc.indexOf("## Icons"), doc.indexOf("## Screenshots"));
    expect(icons).toContain("verbalibera-maskable-512.png");
    expect(icons).toContain("inside");
  });
});
