import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * macOS writes "<name> 2.ext" when a file is saved while its original is open,
 * and 135 of them were TRACKED in this repo and had accumulated for weeks.
 *
 * They are not cosmetic. tests/design-tokens.test.ts skips itself by name, so
 * "tests/design-tokens.test 2.ts" was scanned as a live file and the list of
 * FORBIDDEN palette values inside it was read as violations, failing the design
 * guard on a clean tree. Anything that enumerates files by pattern has the same
 * blind spot.
 *
 * So this fails on a tracked artifact anywhere, which is the only copy that can
 * reach CI, Vercel, and every guard that walks the tree.
 */

const ARTIFACT = / \d+(\.[^/]*)?$/;

const tracked = (): string[] =>
  execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .split("\n")
    .filter(Boolean);

describe("no macOS copy artifacts", () => {
  it("tracks no file whose name ends in a space and a number", () => {
    const offenders = tracked().filter((p) =>
      ARTIFACT.test(p.split("/").pop() ?? ""),
    );
    expect(
      offenders,
      `tracked copy artifacts (delete them, the original is alongside):\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("still finds the original for every name it would reject", () => {
    // Guards against this check ever matching something that is NOT a copy: a
    // real file legitimately named with a trailing number would be unrecoverable
    // if a purge ran against it, so the pattern has to stay narrow enough that
    // an original always exists alongside.
    const names = tracked();
    const set = new Set(names);
    for (const path of names) {
      const base = path.split("/").pop() ?? "";
      if (!ARTIFACT.test(base)) continue;
      const original = path.replace(/ \d+(\.[^/]*)$/, "$1");
      expect(set.has(original), `${path} has no original at ${original}`).toBe(true);
    }
  });
});
