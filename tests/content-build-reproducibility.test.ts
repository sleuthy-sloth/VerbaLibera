import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 0B: reproducible bundles and release checks.
 *
 * Two defects are pinned here.
 *
 * 1. `scripts/content.ts` composed `public/study.css` from the canonical lesson
 *    stylesheet PLUS whatever it found in the generated `public/study.css`. That
 *    read of generated output made the artifact self-amplifying: the only reason
 *    it never grew was that the esbuild step for the offline bundle happened to
 *    overwrite `public/study.css` with the bundled lesson-player CSS first. If
 *    that CSS output ever stopped landing at that path, every build would
 *    prepend the source stylesheet again. The guard below is "the canonical
 *    source appears exactly once, and the player styles are present" — both
 *    halves can fail.
 *
 * 2. Nothing compared two successive builds. Repeated `content:build` runs must
 *    be byte-identical and must leave no unexplained diff against the index,
 *    because release automation consumes these artifacts.
 */

const ROOT = process.cwd();
const TSX = path.join(ROOT, "node_modules/tsx/dist/cli.mjs");

/** Generated artifacts CI and release automation consume. */
const GENERATED = [
  "public/study.js",
  "public/study.css",
  "public/study.html",
  "src/features/course-pack/catalog.json",
  "public/packs/french.json",
  "public/packs/german.json",
  "public/packs/italian.json",
  "public/packs/portuguese.json",
  "public/packs/spanish.json",
  "docs/astra/reports/french.json",
  "docs/astra/reports/german.json",
  "docs/astra/reports/italian.json",
  "docs/astra/reports/portuguese.json",
  "docs/astra/reports/spanish.json",
];

const SOURCE_STYLESHEET = "src/features/course-pack/study.css";
const SOURCE_HEADER = "Warm Studio. These MIRROR the tokens in globals.css";

const read = (relative: string): string => fs.readFileSync(path.join(ROOT, relative), "utf8");

const digest = (relative: string): string =>
  createHash("sha256").update(fs.readFileSync(path.join(ROOT, relative))).digest("hex");

function contentBuild(): void {
  execFileSync(process.execPath, [TSX, "scripts/content.ts", "build"], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

function occurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

describe("content builds are reproducible", () => {
  it(
    "composes public/study.css from canonical source instead of the previous generated file",
    () => {
      contentBuild();
      const generated = read("public/study.css");
      const source = read(SOURCE_STYLESHEET);
      // The accumulated-stylesheet defect shows up as a repeated source block.
      expect(occurrences(generated, SOURCE_HEADER)).toBe(1);
      expect(generated.startsWith(source)).toBe(true);
      // The lesson-player styles the offline bundle emits must still land here.
      expect(generated, "player styles missing from the generated stylesheet").toContain("--lp-ink");
      expect(generated.length).toBeGreaterThan(source.length);
    },
    120_000,
  );

  it("the accumulation detector can fail", () => {
    // Proof the assertion above is not vacuous: replaying the old composition
    // (canonical source prepended to the previous generated file) produces two
    // source blocks, and the detector counts both.
    const source = read(SOURCE_STYLESHEET);
    const alreadyGenerated = read("public/study.css");
    const accumulated = source + "\n" + alreadyGenerated;
    expect(occurrences(accumulated, SOURCE_HEADER)).toBe(2);
  });

  it(
    "produces byte-identical output across two successive builds",
    () => {
      contentBuild();
      const first = GENERATED.map((relative) => [relative, digest(relative)] as const);
      contentBuild();
      const second = GENERATED.map((relative) => [relative, digest(relative)] as const);
      expect(second).toEqual(first);
    },
    120_000,
  );

  it(
    "leaves no unexplained generated diff behind",
    () => {
      contentBuild();
      let diff = "";
      try {
        execFileSync("git", ["diff", "--exit-code", "--", ...GENERATED], {
          cwd: ROOT,
          stdio: "pipe",
        });
      } catch (error) {
        const failure = error as { stdout?: Buffer | string; stderr?: Buffer | string };
        diff = `${failure.stdout ?? ""}${failure.stderr ?? ""}`;
      }
      expect(
        diff,
        "regenerated bundles differ from the index: inspect the diff and commit it with the work",
      ).toBe("");
    },
    120_000,
  );
});
