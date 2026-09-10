import { describe, it, expect } from "vitest";
import { normalizePack, migratePackV1ToV2 } from "@/features/course-pack/normalize-pack";
import { validateV2Pack } from "@/features/course-pack/schema-v2";
import { makeLegacyRawPack } from "./fixtures/lesson-variety";

describe("pack migration parity", () => {
  it("migrates v1 to valid v2 with identical runtime output", () => {
    const v1 = makeLegacyRawPack();
    const migrated = migratePackV1ToV2(v1);
    expect(() => validateV2Pack(migrated)).not.toThrow();
    const fromV1 = normalizePack(v1);
    const fromV2 = normalizePack(migrated);
    const withDefaults = (pack: typeof fromV1) => ({
      ...pack,
      lessons: pack.lessons.map((lesson) => ({
        ...lesson,
        steps: lesson.steps.map((step) => ({ branches: {}, ...step })),
      })),
    });
    const { schemaVersion: _a, ...restV1 } = withDefaults(fromV1);
    const { schemaVersion: _b, ...restV2 } = withDefaults(fromV2);
    expect(restV2).toEqual(restV1);
  });

  it("refuses non-v1 packs", () => {
    expect(() =>
      migratePackV1ToV2({ ...(makeLegacyRawPack() as object), schemaVersion: 2 }),
    ).toThrow();
  });
});
