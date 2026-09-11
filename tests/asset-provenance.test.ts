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

  it("keeps the picture record honest about which files are whose", () => {
    const record = readFileSync(join(ROOT, "docs/image-provenance.md"), "utf8");
    const cc0Table = record.slice(
      record.indexOf("## CC0 and public-domain"),
      record.indexOf("## The project's own"),
    );
    const ownTable = record.slice(record.indexOf("## The project's own"), record.indexOf("## The lesson scenes"));
    const sceneTable = record.slice(
      record.indexOf("## The lesson scenes"),
      record.indexOf("## The course map"),
    );
    const mapTable = record.slice(record.indexOf("## The course map"));

    const rowsOf = (block: string, dir: string): string[] =>
      [...block.matchAll(new RegExp(`^\\| \\\`([\\w.-]+)\\.jpg\\\` \\|`, "gm"))].map(
        (match) => `${dir}/${match[1]}.jpg`,
      );
    const cc0 = rowsOf(cc0Table, "vocab");
    const own = rowsOf(ownTable, "vocab");
    const scenes = rowsOf(sceneTable, "scenes");
    const map = [...mapTable.matchAll(/^\| `([\w.-]+)\.jpg` \|/gm)].map((match) => `map/${match[1]}.jpg`);
    expect(cc0.length, "the CC0 table lost rows").toBe(13);
    expect(own.length, "the project-artwork table lost rows").toBe(9);
    expect(scenes.length, "the scene table lost rows").toBe(6);
    expect(map.length, "the course map is not recorded").toBe(1);
    // The tables have to be disjoint: a file that is the project's own artwork
    // cannot still be listed as a Wikimedia photograph.
    expect(cc0).not.toContain("vocab/piggybank.jpg");
    expect(cc0).not.toContain("vocab/key.jpg");
    for (const file of own) expect(cc0, `${file} is in both tables`).not.toContain(file);

    // Every recorded hash, against the bytes on disk — the CC0 photographs too, so
    // a silent swap of any shipped picture fails here rather than in a screenshot
    // months later. (Proved non-vacuous by corrupting one recorded value, which
    // fails by file name.)
    const hashRows = (block: string, dir: string) =>
      [...block.matchAll(/^\| `([\w.-]+)\.jpg` \|.*\| `([0-9a-f]{64})` \|$/gm)].map(
        ([, name, hash]) => ({ dir, name, hash }),
      );
    const recorded = [
      ...hashRows(cc0Table, "vocab"),
      ...hashRows(ownTable, "vocab"),
      ...hashRows(sceneTable, "scenes"),
      // The map's row has no column for an alt text, so it is read by hand: the
      // table's shape is the file, dimensions, bytes, sha256.
      ...mapTable
        .matchAll(/^\| `([\w.-]+)\.jpg` \|.*\| `([0-9a-f]{64})` \|$/gm)
        .map(([, name, hash]) => ({ dir: "__map", name, hash })),
    ];
    expect(recorded.length, "a table row has no recorded hash").toBe(
      cc0.length + own.length + scenes.length + map.length,
    );
    for (const { dir, name, hash } of recorded) {
      const path =
        dir === "__map" ? `public/images/${name}.jpg` : `public/images/${dir}/${name}.jpg`;
      const onDisk = createHash("sha256").update(readFileSync(join(ROOT, path))).digest("hex");
      expect(onDisk, `${path} no longer matches its recorded hash`).toBe(hash);
    }

    // And the alt text the record quotes is the alt text the fixture ships.
    const fixture = readFileSync(join(ROOT, "src/features/curriculum/fixture.ts"), "utf8");
    for (const alt of [
      "A piggy bank with coins on a table",
      "A teapot and a cup of tea",
      "A cup of coffee on a saucer",
      "A café table with two chairs",
      "An old-fashioned room key with a blank tag",
      "A made hotel bed with a folded towel",
      "A green suitcase beside a folded map",
      "An ambulance parked outside a building",
      "A police car with its roof lights on",
    ]) {
      expect(ownTable, `the record does not quote "${alt}"`).toContain(alt);
      expect(fixture, `the fixture no longer uses "${alt}"`).toContain(alt);
    }

    // The one piece of lettering inside the approved artwork is recorded here, and
    // recorded as something that is not copy. `tests/scenes.test.ts` checks the
    // other half: that it appears in no file under `src/`.
    expect(sceneTable, "the reception sign in the hotel scene is not recorded").toContain("RECEPCIÓN");
    expect(sceneTable).toMatch(/not rendered as copy|not\*\* rendered as copy/);
    expect(sceneTable, "the same-sign-language note is missing").toMatch(/Spanish/);
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
