// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  migrateDatabase,
  assertCompatibleSchema,
  listAvailableMigrations,
  checkStartupSchema,
  type MigrationRunner,
} from "../desktop/runtime/migrations";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-mig-"));
}

/** Fixture migration dir — proves nothing is read from process.cwd(). */
function fixtureMigrations(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-migavail-"));
  fs.mkdirSync(path.join(dir, "20240101000000_init"));
  fs.mkdirSync(path.join(dir, "20260906000002_desktop_local_profiles"));
  return dir;
}

function runner(calls: string[][], applied: string[] = []): MigrationRunner {
  return {
    deploy: async (databaseUrl: string) => {
      calls.push(["deploy", databaseUrl]);
    },
    seed: async (databaseUrl: string) => {
      calls.push(["seed", databaseUrl]);
    },
    listApplied: async () => applied,
  };
}

describe("desktop migration gate", () => {
  it("backs up control metadata before migrating locally", async () => {
    const calls: string[][] = [];
    const dataDir = tmpDir();
    fs.writeFileSync(path.join(dataDir, "postgresql.conf"), "port=1");
    fs.writeFileSync(path.join(dataDir, "PG_VERSION"), "18\n");
    await migrateDatabase({
      mode: "local",
      databaseUrl: "postgresql://verbalibera:***@127.0.0.1:1/verbalibera",
      dataDir,
      appVersion: "0.1.0",
      packagedSchemaVersion: "20260906000002",
      migrationsDir: fixtureMigrations(),
      runner: runner(calls),
    });
    expect(calls[0][0]).toBe("deploy");
    expect(calls[1][0]).toBe("seed");
    const backups = fs.readdirSync(path.join(dataDir, "backups"));
    expect(backups.length).toBe(1);
    expect(
      fs.existsSync(
        path.join(dataDir, "backups", backups[0], "postgresql.conf"),
      ),
    ).toBe(true);
  });

  it("requires explicit approval with pending names in remote mode", async () => {
    const calls: string[][] = [];
    const failure = await migrateDatabase({
      mode: "remote",
      databaseUrl: "postgresql://u:***@db.example.com/app?sslmode=require",
      dataDir: tmpDir(),
      appVersion: "0.1.0",
      packagedSchemaVersion: "20260906000002",
      migrationsDir: fixtureMigrations(),
      approved: false,
      runner: runner(calls, ["20260906000002_desktop_local_profiles"]),
    }).then(
      () => null,
      (e: unknown) => e as { code?: string; pending?: string[] },
    );
    expect(failure?.code).toBe("REMOTE_MIGRATION_APPROVAL_REQUIRED");
    expect(failure?.pending).toEqual(["20240101000000_init"]);
    expect(calls.length).toBe(0);
  });

  it("rejects a stored schema newer than the packaged app", () => {
    const failure = (() => {
      try {
        assertCompatibleSchema("0.1.0", "99999999999999_future", "20260906000002");
        return null;
      } catch (e: unknown) {
        return e as { code?: string };
      }
    })();
    expect(failure?.code).toBe("SCHEMA_TOO_NEW");
    expect(() =>
      assertCompatibleSchema("0.1.0", "99999999999999_future", "20260906000002"),
    ).toThrow(/newer/i);
    expect(() =>
      assertCompatibleSchema("0.1.0", "20260906000002", "20260906000002"),
    ).not.toThrow();
  });

  it("lists available migrations from the given directory, never cwd", () => {
    expect(listAvailableMigrations(fixtureMigrations())).toEqual([
      "20240101000000_init",
      "20260906000002_desktop_local_profiles",
    ]);
    expect(listAvailableMigrations(path.join(tmpDir(), "missing"))).toEqual([]);
  });

  it("passes a fully migrated store with no pending", () => {
    expect(
      checkStartupSchema({
        appVersion: "0.1.0",
        applied: [
          "20240101000000_init",
          "20260906000002_desktop_local_profiles",
        ],
        migrationsDir: fixtureMigrations(),
        packagedSchemaVersion: "20260906000002_desktop_local_profiles",
      }),
    ).toEqual({ pending: [] });
  });

  it("reports pending migrations without migrating", () => {
    expect(
      checkStartupSchema({
        appVersion: "0.1.0",
        applied: ["20260906000002_desktop_local_profiles"],
        migrationsDir: fixtureMigrations(),
        packagedSchemaVersion: "20260906000002_desktop_local_profiles",
      }),
    ).toEqual({ pending: ["20240101000000_init"] });
  });

  it("rejects applied migrations the package does not know", () => {
    const failure = (() => {
      try {
        checkStartupSchema({
          appVersion: "0.1.0",
          applied: [
            "20240101000000_init",
            "20260906000002_desktop_local_profiles",
            "20261201000000_future_feature",
          ],
          migrationsDir: fixtureMigrations(),
          packagedSchemaVersion: "20261201000000",
        });
        return null;
      } catch (e: unknown) {
        return e as { code?: string; message?: string };
      }
    })();
    expect(failure?.code).toBe("SCHEMA_TOO_NEW");
    expect(failure?.message).toMatch(/does not know/i);
  });

  it("rejects a stored schema newer than packaged on startup", () => {
    expect(() =>
      checkStartupSchema({
        appVersion: "0.1.0",
        applied: [
          "20240101000000_init",
          "20260906000002_desktop_local_profiles",
        ],
        migrationsDir: fixtureMigrations(),
        packagedSchemaVersion: "20240101000000_init",
      }),
    ).toThrow(/newer/i);
  });
});
