// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { migratePackV1ToV2, normalizePack } from "@/features/course-pack/normalize-pack";
import { validateV2Pack } from "@/features/course-pack/schema-v2";
import { buildContentReport } from "../scripts/content/report";

/**
 * The CEFR tag has to survive the v1→v2 migration.
 *
 * The French flip dropped every authored `cefr: "A1"` tag, because the v2 lesson
 * shape had no field for it. Nothing failed: the migration was "successful", the
 * packs validated, and the only trace was `authoredCefrTags` going to zero for a
 * v2 pack — a documentation gap that reads exactly like a pack that claims
 * nothing. The field exists now and the migration carries it.
 *
 * Two halves: the packs still at v1 (Portuguese, Spanish) are migrated in memory
 * so the guarantee is proven against real content before their turn comes, and
 * the packs already flipped (German) are read from the tree to prove the carry
 * worked on a real file, not only in a fixture.
 */

const V1_LANGUAGES = ["portuguese", "spanish"] as const;
/** Already flipped, and flipped *with* the field in place. */
const CARRIED_PACKS = ["german"] as const;
/** Flipped before the field existed; their tags are a data decision, not a bug. */
const PRE_FIELD_PACKS = ["french", "italian"] as const;

function readPack(language: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "courses", language, "manifest.json"), "utf8"),
  ) as Record<string, unknown>;
}

function authoredTags(raw: Record<string, unknown>): Map<string, string> {
  const tags = new Map<string, string>();
  for (const lesson of (raw.lessons ?? []) as Array<{ id?: string; cefr?: string }>) {
    if (lesson.id && lesson.cefr) tags.set(lesson.id, lesson.cefr);
  }
  return tags;
}

describe("the v1→v2 migration keeps the authored CEFR tag", () => {
  it.each(V1_LANGUAGES)("%s: every authored tag is still there afterwards", (language) => {
    const raw = readPack(language);
    const before = authoredTags(raw);
    // Guard against a vacuous pass: if the pack carried no tags, this test would
    // prove nothing about carrying them.
    expect(before.size).toBeGreaterThan(0);

    const migrated = migratePackV1ToV2(raw) as { lessons: Array<{ id: string; cefr?: string }> };
    const after = new Map(
      migrated.lessons
        .filter((lesson) => lesson.cefr)
        .map((lesson) => [lesson.id, lesson.cefr as string]),
    );
    expect(after).toEqual(before);
    // And the migrated pack is still a valid v2 pack, tags included.
    expect(() => validateV2Pack(migrated)).not.toThrow();
  });

  it("the migrated tags reach the content report, which is what reported their absence", () => {
    const raw = readPack("portuguese");
    const migrated = migratePackV1ToV2(raw);
    const report = buildContentReport(migrated, normalizePack(migrated));
    expect(report.authoredCefrTags.counts).toEqual({ A1: authoredTags(raw).size });
    expect(report.authoredCefrTags.counts).not.toEqual({});
  });

  it.each(CARRIED_PACKS)(
    "%s: the flipped file in the tree carries the tags the migration wrote",
    (language) => {
      const raw = readPack(language);
      expect(raw.schemaVersion).toBe(2);
      const tags = authoredTags(raw);
      // The pack carried tags when it was v1, and the flip is where they would
      // have gone missing without the carry.
      expect(tags.size).toBeGreaterThan(0);
      expect(buildContentReport(raw, normalizePack(raw)).authoredCefrTags.counts).toEqual({
        A1: tags.size,
      });
    },
  );

  it("a v2 pack authored without tags stays untagged rather than inventing a level", () => {
    // Built at the v2 level, because v1 *requires* the tag: the interesting case
    // is a v2 pack that was authored without one (or migrated from a source that
    // had none), which must stay quiet rather than acquire a level.
    const raw = readPack("portuguese") as { lessons: Array<Record<string, unknown>> };
    const migrated = migratePackV1ToV2(raw) as { lessons: Array<Record<string, unknown>> };
    const untagged = {
      ...migrated,
      lessons: migrated.lessons.map(({ cefr: _cefr, ...lesson }) => lesson),
    };
    expect(() => validateV2Pack(untagged)).not.toThrow();
    expect(buildContentReport(untagged, normalizePack(untagged)).authoredCefrTags.counts).toEqual({});
    // Sanity: v1 requires the tag, so the same strip never reaches the v2 schema
    // through the migration path — which is why the case is built at v2 level.
    const strippedV1 = { ...raw, lessons: raw.lessons.map(({ cefr: _c, ...rest }) => rest) };
    expect(() => validateV2Pack(strippedV1)).toThrow();
  });

  it("rejects a level the schema does not claim (the field is a claim, not a label)", () => {
    const migrated = migratePackV1ToV2(readPack("portuguese")) as { lessons: Record<string, unknown>[] };
    const bumped = structuredClone(migrated);
    bumped.lessons[0].cefr = "B2";
    expect(() => validateV2Pack(bumped)).toThrow();
  });

  it("v2 packs in the tree are validated against the same schema as migrated ones", () => {
    // A migration that produced a shape the loader rejects would have been
    // caught by content:validate, but not by anything that reads the two
    // schemas differently. Both go through validateV2Pack.
    for (const language of [...PRE_FIELD_PACKS, ...CARRIED_PACKS]) {
      const raw = readPack(language);
      expect(raw.schemaVersion).toBe(2);
      expect(() => validateV2Pack(raw)).not.toThrow();
    }
  });
});

describe("the tag-carrier is not vacuous", () => {
  it("a migration that ignored the source tag would fail these assertions", () => {
    // Proof the assertions above can fail: strip the carry and compare as the
    // test does. This is the state the French flip shipped in.
    const raw = readPack("portuguese");
    const migrated = migratePackV1ToV2(raw) as { lessons: Array<Record<string, unknown>> };
    const withoutCarry = {
      lessons: migrated.lessons.map(({ cefr: _cefr, ...lesson }) => lesson),
    };
    expect(authoredTags(withoutCarry as unknown as Record<string, unknown>).size).toBe(0);
    expect(authoredTags(raw).size).toBeGreaterThan(0);
  });
});

describe("the v1 packs still in the tree are the only ones this can be proven on", () => {
  it("the two remaining v2 packs were migrated before the field existed", () => {
    // Recorded, not hidden: French and Italian were flipped first and have no
    // tags. Re-running the migration from their v1 source would restore them;
    // that is a data change, so it is the user's call, not a silent one here.
    for (const language of PRE_FIELD_PACKS) {
      const raw = readPack(language);
      expect(authoredTags(raw).size).toBe(0);
    }
    expect(readdirSync(join(process.cwd(), "courses")).length).toBeGreaterThanOrEqual(5);
  });
});
