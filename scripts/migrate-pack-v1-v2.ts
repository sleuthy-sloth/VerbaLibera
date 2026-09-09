import { readFileSync, writeFileSync } from "node:fs";
import { migratePackV1ToV2 } from "../src/features/course-pack/normalize-pack";
import { validateV2Pack } from "../src/features/course-pack/schema-v2";

/**
 * One-time v1→v2 course manifest migration (variety rollout).
 * Usage: npx tsx scripts/migrate-pack-v1-v2.ts courses/italian/manifest.json
 * Overwrites the file in place after the v2 schema accepts the output.
 * The pack version is kept: runtime normalization is unchanged by construction.
 */
const [path] = process.argv.slice(2);
if (!path) {
  console.error("Usage: tsx scripts/migrate-pack-v1-v2.ts <manifest.json>");
  process.exit(1);
}
const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
if ((raw as { schemaVersion?: unknown }).schemaVersion !== 1) {
  console.error(`Refusing: ${path} is not a schemaVersion 1 pack.`);
  process.exit(1);
}
const migrated = migratePackV1ToV2(raw);
validateV2Pack(migrated);
writeFileSync(path, `${JSON.stringify(migrated, null, 2)}\n`);
console.log(`Migrated ${path} to schemaVersion 2.`);
