// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  migrateDatabase,
  assertCompatibleSchema,
  type MigrationRunner,
} from "../desktop/runtime/migrations";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-mig-"));
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
      databaseUrl: "postgresql://verbalibera:x@127.0.0.1:1/verbalibera",
      dataDir,
      appVersion: "0.1.0",
      packagedSchemaVersion: "20260906000002",
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
      databaseUrl: "postgresql://u:p@db.example.com/app?sslmode=require",
      dataDir: tmpDir(),
      appVersion: "0.1.0",
      packagedSchemaVersion: "20260906000002",
      approved: false,
      runner: runner(calls, ["20260906000002_desktop_local_profiles"]),
    }).then(
      () => null,
      (e: unknown) => e as { code?: string; pending?: string[] },
    );
    expect(failure?.code).toBe("REMOTE_MIGRATION_APPROVAL_REQUIRED");
    expect(failure?.pending).toContain("20260831040000_init");
    expect(failure?.pending).not.toContain(
      "20260906000002_desktop_local_profiles",
    );
    expect(calls.length).toBe(0);
  });

  it("rejects a stored schema newer than the packaged app", () => {
    expect(() =>
      assertCompatibleSchema("0.1.0", "99999999999999_future", "20260906000002"),
    ).toThrow(/newer/i);
    expect(() =>
      assertCompatibleSchema("0.1.0", "20260906000002", "20260906000002"),
    ).not.toThrow();
  });
});
