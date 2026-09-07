// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RESET_PHRASE,
  resetLocalData,
  scheduleStorageChange,
} from "../desktop/runtime/reset";
import { loadSettings } from "../desktop/settings/store";

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const fakeCrypto = {
  isEncryptionAvailable: () => true,
  encryptString: (plain: string) => `enc:${plain}`,
  decryptString: (cipher: string) => cipher.replace(/^enc:/, ""),
};

describe("desktop storage-mode switching", () => {
  it("does not apply a storage-mode change until restart", async () => {
    const dir = tmpDir("verbalibera-storage-");
    const runningDatabaseUrl = "postgresql://verbalibera:x@127.0.0.1:1/db";
    const result = await scheduleStorageChange(
      { mode: "remote", databaseUrl: "postgresql://u:p@db.example.com/app?sslmode=require" },
      {
        userDataDir: dir,
        schemaVersion: "20260906000002",
        runningDatabaseUrl,
        crypto: fakeCrypto,
        testConnection: async () => {},
      },
    );
    expect(result.restartRequired).toBe(true);
    expect(runningDatabaseUrl).toBe("postgresql://verbalibera:x@127.0.0.1:1/db");
    const saved = loadSettings(dir);
    expect(saved.active.mode).toBe("local");
    expect(saved.pending?.mode).toBe("remote");
  });

  it("rejects cleartext remote storage changes", async () => {
    await expect(
      scheduleStorageChange(
        { mode: "remote", databaseUrl: "postgresql://u:p@db.example.com/app" },
        {
          userDataDir: tmpDir("verbalibera-storage-bad-"),
          schemaVersion: "20260906000002",
          runningDatabaseUrl: "postgresql://verbalibera:x@127.0.0.1:1/db",
          crypto: fakeCrypto,
          testConnection: async () => {},
        },
      ),
    ).rejects.toThrow(/TLS/i);
  });

  it("schedules a return to local storage without a connection test", async () => {
    const dir = tmpDir("verbalibera-storage-local-");
    let tested = false;
    await scheduleStorageChange(
      { mode: "local" },
      {
        userDataDir: dir,
        schemaVersion: "20260906000002",
        runningDatabaseUrl: "postgresql://u:p@db.example.com/app",
        crypto: fakeCrypto,
        testConnection: async () => {
          tested = true;
        },
      },
    );
    expect(tested).toBe(false);
    expect(loadSettings(dir).pending?.mode).toBe("local");
  });
});

describe("desktop recoverable reset", () => {
  it("requires the exact reset phrase and moves data to a backup", async () => {
    const dataDir = tmpDir("verbalibera-data-");
    fs.writeFileSync(path.join(dataDir, "PG_VERSION"), "18\n");
    let stopped = false;
    const context = {
      dataDir,
      stopDatabase: async () => {
        stopped = true;
      },
      clock: () => new Date("2026-09-06T12:00:00.000Z"),
    };
    await expect(resetLocalData("reset", context)).rejects.toThrow(
      new RegExp(RESET_PHRASE),
    );
    expect(stopped).toBe(false);
    const result = await resetLocalData(RESET_PHRASE, context);
    expect(stopped).toBe(true);
    expect(result.backupPath).toMatch(/backups\/local-data-/);
    expect(fs.existsSync(path.join(result.backupPath, "PG_VERSION"))).toBe(true);
    expect(fs.existsSync(dataDir)).toBe(true);
    expect(fs.existsSync(path.join(dataDir, "PG_VERSION"))).toBe(false);
  });
});
