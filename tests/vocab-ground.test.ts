// @vitest-environment node

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Where each picture's ground ended up, and why.
 *
 * `scripts/brand/snap-ground.py` repaints a picture's most common colour to the
 * app's canvas cream so the illustration sits on the page instead of on a faint
 * rectangle of its own. It is deliberately **not** applied to every file: the
 * premise is that the most common colour is a *ground*, and for several files it
 * is a drawn surface instead. Snapping `key.jpg` repaints the door. Snapping
 * `bill.jpg` repaints the leather folder, `hospital.jpg` the tan facade, `map.jpg`
 * the wooden tabletop. That judgement has been made four times now, twice in the
 * right direction and twice the other way, so it is checked here rather than
 * remembered.
 *
 * The verdict comes from the script itself — the same code that does the
 * repainting — so this cannot drift from the tool it describes.
 */

const ROOT = process.cwd();

/** Pictures that sit on the canvas, i.e. the script reports them as exact. */
const ON_THE_CANVAS = [
  "ambulance.jpg",
  "bed.jpg",
  "card.jpg",
  "coffee.jpg",
  "directions.jpg",
  "door.jpg",
  "hotel-checkin.jpg",
  "hotel.jpg",
  "museum.jpg",
  "ordering-coffee.jpg",
  "piggybank.jpg",
  "police.jpg",
  "shopkeeper.jpg",
  "station-counter.jpg",
  "street.jpg",
  "suitcase.jpg",
  "table.jpg",
  "tea.jpg",
  "wallet.jpg",
];

/**
 * Pictures deliberately left alone, each for a reason that would be wrong to
 * "fix". Six are the drawings whose most common colour is part of the subject;
 * three are photographs the project did not draw and never snapped.
 */
const LEFT_ALONE: Record<string, string> = {
  "key.jpg": "its most common colour is the drawn door (#7a8e6b), so snapping repaints the door",
  "bill.jpg": "the dark leather bill folder (#41392c)",
  "hospital.jpg": "the drawn tan facade (#e1caa0)",
  "map.jpg": "the drawn wooden tabletop (#d9bb87)",
  "asking-for-the-bill.jpg": "the drawn café table (#d9c394)",
  "minor-emergency.jpg": "the drawn ground of the street scene (#dcc99f)",
  "passport.jpg": "a CC0 photograph, never snapped",
  "phone.jpg": "a CC0 photograph, never snapped",
  "station.jpg": "a CC0 photograph, never snapped",
};

const files = [
  ...readdirSync(join(ROOT, "public/images/vocab"))
    .filter((name) => name.endsWith(".jpg"))
    .map((name) => `public/images/vocab/${name}`),
  ...readdirSync(join(ROOT, "public/images/scenes"))
    .filter((name) => name.endsWith(".jpg"))
    .map((name) => `public/images/scenes/${name}`),
].sort();

/** Run the project's own checker and read its per-file verdicts. */
const check = (paths: string[]): { ok: string[]; bad: string[] } => {
  let output: string;
  try {
    output = execFileSync("python3", ["scripts/brand/snap-ground.py", "--check", ...paths], {
      encoding: "utf8",
    });
  } catch (error) {
    // The script exits 1 when anything fails its check, which is the expected
    // outcome for the second half of this test.
    output = (error as { stdout?: string }).stdout ?? "";
  }
  const ok: string[] = [];
  const bad: string[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(OK|BAD)\s+(\S+\.jpg)/);
    if (!match) continue;
    (match[1] === "OK" ? ok : bad).push(match[2]);
  }
  return { ok: ok.sort(), bad: bad.sort() };
};

describe("the ground of every picture the app draws", () => {
  it("puts the illustrations on the canvas and reports which ones it did not touch", () => {
    expect(files.length, "no pictures were found to check").toBe(28);
    const { ok, bad } = check(files);

    // The checker reports file names; these lists are names too.
    expect(ok, "pictures that are not on the canvas cream").toEqual([...ON_THE_CANVAS].sort());
    expect(bad, "the set of pictures left alone changed").toEqual(
      Object.keys(LEFT_ALONE).sort(),
    );
    // Every exception carries its reason in this file, so a new one cannot be
    // added by measuring and forgetting.
    expect(Object.keys(LEFT_ALONE).length).toBe(bad.length);
  });

  it("reports a clean run when it is only given the snapped pictures", () => {
    // The other half of the same claim: the nineteen really do pass.
    const only = files.filter((path) => ON_THE_CANVAS.some((name) => path.endsWith(`/${name}`)));
    expect(only.length, "the snapped list names pictures that do not exist").toBe(
      ON_THE_CANVAS.length,
    );
    const { ok, bad } = check(only);
    expect(bad, "a picture that should be on the canvas is not").toEqual([]);
    expect(ok.length).toBe(only.length);
  });
});
