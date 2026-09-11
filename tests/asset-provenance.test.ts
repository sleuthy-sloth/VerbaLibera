// @vitest-environment node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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

  it("records the German banner as its approved reference, with the re-frame as history", () => {
    // Measured, not asserted from memory: scripts/brand/compare-reference.py
    // reports the shipped file at shift 0 against its reference (the ground-snap
    // re-encode shows up as ~1.5 mean grey, the same order as the other four),
    // where it was 71.10 at a +278px shift while the re-framed file shipped. The
    // document has to carry both: the verdict, because a future maintainer
    // comparing app against artwork needs to know they now match, and the history,
    // because the brief's column analysis is why the re-frame existed.
    const references = doc.slice(doc.indexOf("## Approved references"));
    expect(references).toContain("courses/german.jpg");
    expect(references, "the shipped file's verdict is missing").toContain(
      "the reference, ground snapped to the canvas",
    );
    expect(references, "the re-frame's history is missing").toContain("+278 px");
    for (const language of ["french", "italian", "spanish", "portuguese"])
      expect(references, `${language} is not in the comparison table`).toContain(
        `courses/${language}.jpg`,
      );
    // Both crop windows, because which one applies is exactly what the swap
    // changed: 2.75 at 100% now ships, 2.39 at 50.4% is what the re-frame needed.
    expect(references).toMatch(/2\.75/);
    expect(references).toMatch(/100%/);
    expect(references).toMatch(/2\.39/);
  });

  it("keeps the vocabulary record honest about which pictures are whose", () => {
    const record = readFileSync(join(ROOT, "docs/image-provenance.md"), "utf8");
    const cc0Table = record.slice(record.indexOf("## CC0 and public-domain"), record.indexOf("## The project's own"));
    const ownTable = record.slice(record.indexOf("## The project's own"));

    const rows = (block: string): string[] =>
      [...block.matchAll(/^\| `([\w.]+)\.jpg` \|/gm)].map((match) => match[1]);
    expect(rows(cc0Table).length, "the CC0 table lost rows").toBe(18);
    expect(rows(ownTable).length, "the project-artwork table lost rows").toBe(4);
    expect(rows(cc0Table)).not.toContain("piggybank");

    // The four hashes in the document, against the files: a silent swap of one of
    // these pictures fails here rather than in a screenshot months later.
    const hashes = [...ownTable.matchAll(/\| \`(\w+)\.jpg\` \|[^|]+\|[^|]+\|[^|]+\|[^|]+\| \`([0-9a-f]{64})\` \|/g)];
    expect(hashes.length, "the four pictures have no recorded hashes").toBe(4);
    for (const [, name, recorded] of hashes) {
      const onDisk = createHash("sha256")
        .update(readFileSync(join(ROOT, `public/images/vocab/${name}.jpg`)))
        .digest("hex");
      expect(onDisk, `${name}.jpg no longer matches its recorded hash`).toBe(recorded);
    }
    // And the alt text the record quotes is the alt text the fixture ships.
    const fixture = readFileSync(join(ROOT, "src/features/curriculum/fixture.ts"), "utf8");
    for (const alt of [
      "A piggy bank with coins on a table",
      "A teapot and a cup of tea",
      "A cup of coffee on a saucer",
      "A café table with two chairs",
    ]) {
      expect(ownTable, `the record does not quote "${alt}"`).toContain(alt);
      expect(fixture, `the fixture no longer uses "${alt}"`).toContain(alt);
    }
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
