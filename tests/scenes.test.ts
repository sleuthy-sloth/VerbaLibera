// @vitest-environment node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SCENE_SOURCE,
  SCENE_URLS,
  SCENES,
  sceneForLessonId,
  sceneForScenario,
} from "@/features/course-pack/scenes";
import { collectPortableContent } from "../scripts/portable/content";
import { imageDimensions } from "./helpers/image-size";

/**
 * Lesson-scene coverage.
 *
 * The five approved situation pictures are keyed by *situation*, not by lesson:
 * one table serves every language because the travel patterns' `scenario` strings
 * are shared verbatim across French, Italian, Spanish and Portuguese. Two lookups
 * reach them — an authored scenario (the travel sessions) and a lesson-id segment
 * (the packs) — and both are checked against the real data, because a lookup that
 * silently stops matching would drop the picture with nothing failing.
 *
 * The pictures are decorative on the lesson surfaces (the lesson title, its
 * objective and the session's scenario line say the same thing in words), so the
 * last assertions here are about what must *not* appear: a file that exists but is
 * never embedded in the portable edition, and the one piece of lettering the
 * approved artwork contains, which belongs in `docs/image-provenance.md` and
 * nowhere near a rendered string.
 */

const ROOT = process.cwd();

const sceneDir = join(ROOT, "public/images/scenes");
const sceneFiles = () =>
  execFileSync("ls", [sceneDir], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();

describe("lesson scenes", () => {
  it("ships the picture each situation names, at the contract size", () => {
    expect(SCENES.length, "the situation table lost entries").toBe(5);
    expect(SCENE_SOURCE).toEqual({ width: 800, height: 600 });
    for (const scene of SCENES) {
      const path = join(ROOT, "public", scene.url.replace(/^\//, ""));
      expect(existsSync(path), `${scene.url} is missing`).toBe(true);
      const size = imageDimensions(path)!;
      expect([size.width, size.height], `${scene.url} is not ${SCENE_SOURCE.width}x${SCENE_SOURCE.height}`).toEqual([
        SCENE_SOURCE.width,
        SCENE_SOURCE.height,
      ]);
      expect(scene.width, `${scene.situation} declares the wrong width`).toBe(size.width);
      expect(scene.height, `${scene.situation} declares the wrong height`).toBe(size.height);
      expect(scene.url.startsWith("/images/scenes/"), `${scene.url} is outside the scene folder`).toBe(true);
      expect(scene.label.length, `${scene.situation} has no description`).toBeGreaterThan(20);
    }
    // And the folder holds nothing the table does not know about: an orphan file
    // here is artwork nobody can see.
    expect(sceneFiles()).toEqual(SCENE_URLS.map((url) => url.replace("/images/scenes/", "")).sort());
  });

  it("resolves the authored pattern scenarios, and only the ones it knows", () => {
    const fixture = readFileSync(join(ROOT, "src/features/curriculum/fixture.ts"), "utf8");
    const expected: [string, string][] = [
      ["Ordering coffee or food", "ordering-coffee"],
      ["Paying", "asking-for-the-bill"],
      ["Checking in at a hotel", "hotel-checkin"],
      ["Asking for directions", "directions"],
      ["Finding a place", "directions"],
    ];
    for (const [scenario, situation] of expected) {
      // The guard that matters: the scenario string has to exist in the fixture.
      // Rewording one there without touching this table would drop the picture.
      expect(fixture, `the fixture no longer has the scenario "${scenario}"`).toContain(
        `scenario: '${scenario}'`,
      );
      expect(sceneForScenario(scenario)?.situation, `${scenario} maps to the wrong scene`).toBe(situation);
    }
    // A situation with no scene is not guessed at.
    expect(sceneForScenario("Getting help in an emergency")).toBeUndefined();
    expect(sceneForScenario("Greeting politely")).toBeUndefined();
    expect(sceneForScenario("")).toBeUndefined();
  });

  it("resolves the pack lessons that are one of the five situations", () => {
    const expected: [string, string][] = [
      ["de-cafe-requests-foundation", "ordering-coffee"],
      ["de-directions-foundation", "directions"],
      ["fr-transport-foundation", "station-counter"],
      ["it-transport-foundation", "station-counter"],
    ];
    for (const [lessonId, situation] of expected)
      expect(sceneForLessonId(lessonId)?.situation, `${lessonId} maps to the wrong scene`).toBe(situation);

    // Most lessons are not a situation: they get no picture rather than a near
    // miss, which is why these specific ids must stay undefined.
    for (const lessonId of [
      "de-family-people-foundation",
      "fr-plural-foundation",
      "fr-first-words-foundation",
      "it-weather-foundation",
      "pt-market-foundation",
    ])
      expect(sceneForLessonId(lessonId), `${lessonId} should have no scene`).toBeUndefined();
  });

  it("reaches every situation through at least one surface", () => {
    // Coverage in the other direction: a situation table entry nothing can reach
    // is a picture shipped for no one.
    const reachable = new Set<string>();
    for (const scenario of ["Ordering coffee or food", "Paying", "Checking in at a hotel", "Asking for directions"])
      reachable.add(sceneForScenario(scenario)!.situation);
    for (const lessonId of ["de-cafe-requests-foundation", "fr-transport-foundation"])
      reachable.add(sceneForLessonId(lessonId)!.situation);
    expect([...reachable].sort()).toEqual(SCENES.map((scene) => scene.situation).sort());
    expect(new Set(SCENE_URLS).size, "two situations share a file").toBe(SCENE_URLS.length);
  });

  it("embeds every scene in the portable edition", () => {
    // The portable shell resolves media through `environment.resolveMedia`, which
    // throws on an asset the file does not carry, so a scene the app can render
    // has to travel with it. Derived through the collector rather than hand-listed,
    // the way the course banners are.
    const { assets } = collectPortableContent(ROOT);
    for (const url of SCENE_URLS)
      expect(assets[url], `the portable edition does not embed ${url}`).toBeDefined();
  });

  it("keeps the artwork's own lettering out of the app", () => {
    // One approved file has a sign in it: hotel-checkin.jpg reads "RECEPCIÓN". The
    // rule is that illustration text is recorded in the provenance document and
    // never becomes UI copy, so no file under `src/` may contain it — not a label,
    // not an aria label, not a caption.
    let matches = "";
    try {
      matches = execFileSync("grep", ["-rl", "RECEPCIÓN", "src"], { encoding: "utf8" }).trim();
    } catch {
      matches = ""; // grep exits 1 when nothing matches, which is the pass
    }
    expect(matches, "artwork lettering reached a rendered string").toBe("");

    // And the scene data itself carries no lettering the surfaces could render.
    const rendered = SCENES.map((scene) => `${scene.label} ${scene.url}`).join("\n");
    expect(rendered).not.toContain("RECEPCIÓN");
  });
});
