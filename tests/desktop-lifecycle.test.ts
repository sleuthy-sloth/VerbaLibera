// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { ServiceLifecycle } from "../desktop/runtime/lifecycle";
import type { LaunchedServer } from "../desktop/runtime/server";

function deferred<T = number>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeServer(exited?: Promise<number>): {
  server: LaunchedServer;
  kill: () => void;
} {
  const kill = vi.fn();
  return {
    kill,
    server: { pid: 4242, kill, exited: exited ?? Promise.resolve(0) },
  };
}

function fakeDatabase() {
  return {
    process: {
      pid: 4343,
      databaseUrl: "postgresql://verbalibera:***@127.0.0.1:1/verbalibera",
      dataDir: "/data/db/pgdata",
      port: 1,
      password: "pw",
      kill: vi.fn(),
    },
    runtime: { spawn: vi.fn(async () => ({ pid: 0, exitCode: 0 })), runtimeBinDir: "/bin" },
  };
}

const realSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

describe("desktop service lifecycle", () => {
  it("stops the server before the database on shutdown", async () => {
    const order: string[] = [];
    const { server, kill } = fakeServer();
    const db = fakeDatabase();
    db.runtime.spawn.mockImplementation(async () => {
      order.push("db-stop");
      return { pid: 0, exitCode: 0 };
    });
    const lifecycle = new ServiceLifecycle({ sleep: realSleep });
    lifecycle.attachServer({ ...server, kill: () => { order.push("server-kill"); kill(); } });
    lifecycle.attachDatabase(db.process, db.runtime);
    await lifecycle.shutdown();
    expect(order).toEqual(["server-kill", "db-stop"]);
    expect(kill).toHaveBeenCalledOnce();
  });

  it("is a no-op with nothing attached", async () => {
    const lifecycle = new ServiceLifecycle({ sleep: realSleep });
    await expect(lifecycle.shutdown()).resolves.toBeUndefined();
    await expect(lifecycle.stopServer()).resolves.toBeUndefined();
    await expect(lifecycle.stopDatabase()).resolves.toBeUndefined();
  });

  it("runs concurrent shutdowns once and serializes them", async () => {
    const kill = vi.fn();
    let release!: () => void;
    const gate = new Promise<number>((resolve) => { release = () => resolve(0); });
    const lifecycle = new ServiceLifecycle({ sleep: realSleep });
    lifecycle.attachServer({ pid: 1, kill, exited: gate });
    const first = lifecycle.shutdown();
    const second = lifecycle.shutdown();
    const third = lifecycle.stopServer();
    release();
    await Promise.all([first, second, third]);
    expect(kill).toHaveBeenCalledOnce();
  });

  it("escalates to SIGKILL when the server ignores SIGTERM", async () => {
    const kill = vi.fn();
    const signalPid = vi.fn();
    const lifecycle = new ServiceLifecycle({
      sleep: realSleep,
      signalPid,
      serverStopTimeoutMs: 20,
    });
    lifecycle.attachServer({
      pid: 7777,
      kill,
      exited: new Promise<number>(() => {}),
    });
    await lifecycle.stopServer();
    expect(kill).toHaveBeenCalledOnce();
    expect(signalPid).toHaveBeenCalledWith(7777, "SIGKILL");
  });

  it("never signals after a clean exit, even if the PID is recycled", async () => {
    const gate = deferred();
    const signalPid = vi.fn();
    const lifecycle = new ServiceLifecycle({
      sleep: realSleep,
      signalPid,
      serverStopTimeoutMs: 20,
    });
    lifecycle.attachServer({ pid: 8888, kill: () => {}, exited: gate.promise });
    const stopping = lifecycle.stopServer();
    gate.resolve(0);
    await stopping;
    await realSleep(60);
    expect(signalPid).not.toHaveBeenCalled();
  });

  it("falls back to kill when graceful database stop fails", async () => {
    const db = fakeDatabase();
    db.runtime.spawn.mockRejectedValue(new Error("pg_ctl stop failed"));
    const kill = vi.fn();
    const lifecycle = new ServiceLifecycle({ sleep: realSleep });
    lifecycle.attachDatabase({ ...db.process, kill }, db.runtime);
    await expect(lifecycle.stopDatabase()).resolves.toBeUndefined();
    expect(kill).toHaveBeenCalledOnce();
  });

  it("lets reset stop the server first while the database stop stays pending", async () => {
    const order: string[] = [];
    const { server } = fakeServer();
    const db = fakeDatabase();
    db.runtime.spawn.mockImplementation(async () => {
      order.push("db-stop");
      return { pid: 0, exitCode: 0 };
    });
    const lifecycle = new ServiceLifecycle({ sleep: realSleep });
    lifecycle.attachServer({ ...server, kill: () => { order.push("server-kill"); } });
    lifecycle.attachDatabase(db.process, db.runtime);
    await lifecycle.stopServer();
    expect(order).toEqual(["server-kill"]);
    expect(lifecycle.currentServer).toBeNull();
    await lifecycle.stopDatabase();
    expect(order).toEqual(["server-kill", "db-stop"]);
  });
});
