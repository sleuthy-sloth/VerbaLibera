// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startLocalPostgres, stopOwnedProcess } from "../desktop/runtime/postgres";
import { ownsRecordedProcess } from "../desktop/runtime/process-identity";
import type { PostgresContext } from "../desktop/runtime/contracts";

interface SpawnCall {
  cmd: string;
  args: string[];
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-pg-"));
}

function fakeContext(dataRoot: string, calls: SpawnCall[]): PostgresContext & { probed: string[] } {
  const probed: string[] = [];
  return {
    runtimeBinDir: "/staged/postgres/bin",
    dataRoot,
    spawn: (async (cmd: string, args: string[]) => {
      calls.push({ cmd, args });
      return { pid: 4242 };
    }) as PostgresContext["spawn"],
    randomBytes: ((n: number) => Buffer.alloc(n, 7)) as PostgresContext["randomBytes"],
    allocPort: async () => 55444,
    probe: async (url: string) => {
      probed.push(url);
      return true;
    },
    sleep: async () => {},
    probed,
  };
}

describe("desktop local PostgreSQL lifecycle", () => {
  it("initializes local data with generated credentials and loopback only", async () => {
    const calls: SpawnCall[] = [];
    const dataRoot = tmpDir();
    const result = await startLocalPostgres(fakeContext(dataRoot, calls));
    expect(result.databaseUrl).toMatch(/^postgresql:\/\/verbalibera:/);
    expect(result.databaseUrl).toMatch(/@127\.0\.0\.1:55444\/verbalibera/);
    const generatedPassword = new URL(result.databaseUrl).password;
    expect(generatedPassword).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const initdb = calls.find((c) => c.cmd.endsWith("initdb"));
    expect(initdb?.args.join(" ")).toMatch(/--auth=scram-sha-256/);
    const ctl = calls.find((c) => c.cmd.endsWith("pg_ctl") && c.args[0] === "start");
    expect(ctl?.args.join(" ")).toContain("listen_addresses=127.0.0.1");
    expect(fs.statSync(path.join(dataRoot, "pgdata")).mode & 0o777).toBe(0o700);
  });

  it("probes the maintenance database before migrate creates the app database", async () => {
    const calls: SpawnCall[] = [];
    const context = fakeContext(tmpDir(), calls);
    await startLocalPostgres(context);
    expect(context.probed.length).toBeGreaterThan(0);
    for (const url of context.probed) {
      expect(new URL(url).pathname).toBe("/postgres");
    }
  });

  it("skips initdb when the data directory is already initialized", async () => {
    const calls: SpawnCall[] = [];
    const dataRoot = tmpDir();
    fs.mkdirSync(path.join(dataRoot, "pgdata"), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, "pgdata", "PG_VERSION"), "18\n");
    await startLocalPostgres(fakeContext(dataRoot, calls));
    expect(calls.some((c) => c.cmd.endsWith("initdb"))).toBe(false);
    expect(calls.some((c) => c.cmd.endsWith("pg_ctl"))).toBe(true);
  });

  it("reuses the stored password when relaunching an existing cluster", async () => {
    const calls: SpawnCall[] = [];
    const dataRoot = tmpDir();
    fs.mkdirSync(path.join(dataRoot, "pgdata"), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, "pgdata", "PG_VERSION"), "18\n");
    const context = fakeContext(dataRoot, calls);
    context.password = "stored-secret-from-safe-storage";
    const result = await startLocalPostgres(context);
    expect(result.password).toBe("stored-secret-from-safe-storage");
    expect(result.databaseUrl).toContain("stored-secret-from-safe-storage");
    expect(calls.some((c) => c.cmd.endsWith("initdb"))).toBe(false);
  });

  it("stops the owned server with pg_ctl before falling back to kill", async () => {
    const calls: SpawnCall[] = [];
    const dataRoot = tmpDir();
    const context = fakeContext(dataRoot, calls);
    const owned = await startLocalPostgres(context);
    let killed = false;
    await stopOwnedProcess(
      { ...owned, kill: () => void (killed = true) },
      { spawn: context.spawn, runtimeBinDir: context.runtimeBinDir },
    );
    const stop = calls.find((c) => c.args[0] === "stop");
    expect(stop?.cmd.endsWith("pg_ctl")).toBe(true);
    expect(killed).toBe(false);
  });

  it("kill signals the real postmaster instead of being a no-op", async () => {
    const calls: SpawnCall[] = [];
    const dataRoot = tmpDir();
    fs.mkdirSync(path.join(dataRoot, "pgdata"), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, "pgdata", "PG_VERSION"), "18\n");
    fs.writeFileSync(path.join(dataRoot, "pgdata", "postmaster.pid"), "98765\n");
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const context = fakeContext(dataRoot, calls);
    context.signal = (pid, signal) => {
      signals.push({ pid, signal });
    };
    const owned = await startLocalPostgres(context);
    expect(owned.pid).toBe(98765);
    owned.kill();
    expect(signals).toEqual([{ pid: 98765, signal: "SIGTERM" }]);
  });

  it("kill tolerates an already-stopped postmaster", async () => {
    const calls: SpawnCall[] = [];
    const dataRoot = tmpDir();
    fs.mkdirSync(path.join(dataRoot, "pgdata"), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, "pgdata", "PG_VERSION"), "18\n");
    fs.writeFileSync(path.join(dataRoot, "pgdata", "postmaster.pid"), "98765\n");
    const context = fakeContext(dataRoot, calls);
    context.signal = () => {
      throw new Error("ESRCH");
    };
    const owned = await startLocalPostgres(context);
    expect(() => owned.kill()).not.toThrow();
  });
});

describe("desktop process identity", () => {
  it("does not trust a stale PID that belongs to another executable", async () => {
    const record = { pid: 9999, executable: "postgres", startedAt: "t0" };
    const inspector = {
      commandOf: async () => "something-else",
      startTimeOf: async () => "t0",
    };
    expect(await ownsRecordedProcess(record, inspector)).toBe(false);
  });

  it("trusts a PID with matching executable and start time", async () => {
    const record = { pid: 4242, executable: "postgres", startedAt: "t0" };
    const inspector = {
      commandOf: async () => "/staged/postgres/bin/postgres",
      startTimeOf: async () => "t0",
    };
    expect(await ownsRecordedProcess(record, inspector)).toBe(true);
  });
});
