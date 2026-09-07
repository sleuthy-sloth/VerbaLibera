// Migration, seed, backup, and downgrade rules for the desktop app (Task 4).
// Before migrating, control metadata is copied into `backups/<timestamp>/`.
// `prisma migrate deploy` then the idempotent seed run with DATABASE_URL
// only in the child environment. Remote mode returns pending migration
// names and requires explicit approval; a stored schema newer than the
// packaged compatibility version is rejected.
import fs from "node:fs";
import path from "node:path";
import { desktopFailure } from "./errors";

export interface MigrationRunner {
  deploy: (databaseUrl: string) => Promise<void>;
  seed: (databaseUrl: string) => Promise<void>;
  listApplied: (databaseUrl: string) => Promise<string[]>;
}

export interface MigrateOptions {
  mode: "local" | "remote";
  databaseUrl: string;
  dataDir: string;
  appVersion: string;
  packagedSchemaVersion: string;
  /** Packaged migration directory (ResourceLayout.migrationsDir). Never cwd:
   * Finder launches must not depend on the repository directory. */
  migrationsDir: string;
  approved?: boolean;
  clock?: () => Date;
  runner: MigrationRunner;
  onStage?: (stage: "deploy" | "seed") => void;
}

export interface ApprovalRequiredError extends Error {
  code: "REMOTE_MIGRATION_APPROVAL_REQUIRED";
  pending: string[];
}

export function listAvailableMigrations(migrationsDir: string): string[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function pendingMigrations(
  available: string[],
  applied: string[],
): string[] {
  const done = new Set(applied);
  return available.filter((m) => !done.has(m));
}

function backupControlMetadata(dataDir: string, clock: () => Date): string {
  const stamp = clock().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(dataDir, "backups", stamp);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const name of ["postgresql.conf", "pg_hba.conf", "PG_VERSION"]) {
    const source = path.join(dataDir, name);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(backupDir, name));
    }
  }
  return backupDir;
}

/** Compares zero-padded numeric prefixes (migration timestamps). */
export function compareSchemaVersions(a: string, b: string): number {
  const pa = a.split("_")[0] ?? "";
  const pb = b.split("_")[0] ?? "";
  if (pa === pb) return a < b ? -1 : a > b ? 1 : 0;
  return pa < pb ? -1 : 1;
}

export function assertCompatibleSchema(
  _appVersion: string,
  storedSchemaVersion: string,
  packagedSchemaVersion: string,
): void {
  if (compareSchemaVersions(storedSchemaVersion, packagedSchemaVersion) > 0) {
    throw desktopFailure(
      "SCHEMA_TOO_NEW",
      `Stored schema ${storedSchemaVersion} is newer than packaged ${packagedSchemaVersion}; refusing downgrade.`,
    );
  }
}

export interface StartupSchemaCheck {
  appVersion: string;
  /** Migration names recorded as applied in the database. */
  applied: string[];
  /** Packaged migration directory (ResourceLayout.migrationsDir). */
  migrationsDir: string;
  packagedSchemaVersion: string;
}

/**
 * Pre-boot schema gate for ordinary startup (both modes). Rejects stored
 * schemas the packaged app cannot verify — unknown migration names or
 * anything newer than packaged — before the server starts. Returns pending
 * names so the caller can route to explicit approval. Never migrates.
 */
export function checkStartupSchema(check: StartupSchemaCheck): {
  pending: string[];
} {
  const available = listAvailableMigrations(check.migrationsDir);
  const known = new Set(available);
  const unknown = check.applied.filter((m) => !known.has(m));
  if (unknown.length > 0) {
    throw desktopFailure(
      "SCHEMA_TOO_NEW",
      `Stored schema has migrations this app does not know: ${unknown.join(", ")}; refusing to start.`,
    );
  }
  const stored =
    check.applied.length > 0 ? [...check.applied].sort().at(-1)! : "none";
  if (stored !== "none") {
    assertCompatibleSchema(check.appVersion, stored, check.packagedSchemaVersion);
  }
  return { pending: pendingMigrations(available, check.applied) };
}

export async function migrateDatabase(options: MigrateOptions): Promise<{
  backupDir: string;
  pending: string[];
}> {
  const clock = options.clock ?? (() => new Date());
  const backupDir = backupControlMetadata(options.dataDir, clock);
  const applied = await options.runner.listApplied(options.databaseUrl);
  const pending = pendingMigrations(
    listAvailableMigrations(options.migrationsDir),
    applied,
  );
  if (options.mode === "remote" && pending.length > 0 && !options.approved) {
    const error = new Error(
      `Remote migration needs approval for: ${pending.join(", ")}`,
    ) as ApprovalRequiredError;
    error.code = "REMOTE_MIGRATION_APPROVAL_REQUIRED";
    error.pending = pending;
    throw error;
  }
  const stored = applied.length > 0 ? applied.sort().at(-1)! : "none";
  if (stored !== "none") {
    assertCompatibleSchema(
      options.appVersion,
      stored,
      options.packagedSchemaVersion,
    );
  }
  if (pending.length > 0 || options.mode === "local") {
    options.onStage?.("deploy");
    await options.runner.deploy(options.databaseUrl);
  }
  options.onStage?.("seed");
  await options.runner.seed(options.databaseUrl);
  return { backupDir, pending };
}
