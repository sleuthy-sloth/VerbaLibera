// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  runLocalSetup,
  inspectRemoteSetup,
  approveRemoteSetup,
} from "../desktop/setup/flows";
import { ensureJwtKeys } from "../desktop/setup/keys";

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("desktop first-launch setup flows", () => {
  it("saves local settings only after database and server succeed", async () => {
    const dir = tmpDir("verbalibera-setup-");
    const calls: string[] = [];
    const settings = await runLocalSetup({
      userDataDir: dir,
      schemaVersion: "20260906000002",
      initDatabase: async () => {
        calls.push("initDatabase");
        return {
          databaseUrl: "postgresql://verbalibera:x@127.0.0.1:1/verbalibera",
          dataDir: path.join(dir, "pgdata"),
        };
      },
      migrate: async () => {
        calls.push("migrate");
      },
      startServer: async () => {
        calls.push("startServer");
      },
    });
    expect(calls).toEqual(["initDatabase", "migrate", "startServer"]);
    expect(settings.active).toEqual({
      mode: "local",
      schemaVersion: "20260906000002",
    });
    const saved = JSON.parse(
      fs.readFileSync(path.join(dir, "settings.json"), "utf8"),
    );
    expect(saved.active.mode).toBe("local");
  });

  it("writes nothing when database initialization fails", async () => {
    const dir = tmpDir("verbalibera-setup-fail-");
    await expect(
      runLocalSetup({
        userDataDir: dir,
        schemaVersion: "20260906000002",
        initDatabase: async () => {
          throw new Error("initdb exploded");
        },
        migrate: async () => {},
        startServer: async () => {},
      }),
    ).rejects.toThrow(/initdb exploded/);
    expect(fs.existsSync(path.join(dir, "settings.json"))).toBe(false);
  });

  it("issues one-use remote approval tokens that expire", async () => {
    const tokens = new Map<string, { url: string; expiresAt: number }>();
    const inspected = await inspectRemoteSetup(
      "postgresql://u:p@db.example.com/app?sslmode=require",
      {
        tokens,
        now: () => 1_000,
        testConnection: async () => {},
        listPending: async () => ["20260831040000_init"],
      },
    );
    expect(inspected.pending).toEqual(["20260831040000_init"]);
    const first = await approveRemoteSetup(inspected.approvalToken, {
      tokens,
      now: () => 2_000,
      finish: async () => ({ ok: true as const }),
    });
    expect(first).toEqual({ ok: true });
    await expect(
      approveRemoteSetup(inspected.approvalToken, {
        tokens,
        now: () => 3_000,
        finish: async () => ({ ok: true as const }),
      }),
    ).rejects.toThrow(/approval/i);
  });

  it("rejects expired approval tokens", async () => {
    const tokens = new Map<string, { url: string; expiresAt: number }>();
    const inspected = await inspectRemoteSetup(
      "postgresql://u:p@db.example.com/app?sslmode=require",
      {
        tokens,
        now: () => 1_000,
        testConnection: async () => {},
        listPending: async () => [],
      },
    );
    await expect(
      approveRemoteSetup(inspected.approvalToken, {
        tokens,
        now: () => 1_000 + 5 * 60_000 + 1,
        finish: async () => ({ ok: true as const }),
      }),
    ).rejects.toThrow(/expir/i);
  });
});

describe("desktop per-install JWT keys", () => {
  it("generates an ES256 pair with restricted permissions", () => {
    const dir = tmpDir("verbalibera-keys-");
    const first = ensureJwtKeys(dir);
    const second = ensureJwtKeys(dir);
    expect(first).toEqual(second);
    for (const file of [first.privatePath, first.publicPath]) {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
    expect(fs.readFileSync(first.privatePath, "utf8")).toMatch(
      /BEGIN PRIVATE KEY/,
    );
    expect(fs.readFileSync(first.publicPath, "utf8")).toMatch(
      /BEGIN PUBLIC KEY/,
    );
  });
});
