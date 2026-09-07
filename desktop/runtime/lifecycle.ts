// Single serialized shutdown path for owned desktop services (Milestone B2).
// Restart, reset, crash recovery preparation, and app quit all funnel through
// one owner of the Next.js child server and the owned PostgreSQL cluster, so
// no path can leave a listener on the fixed application port or skip a
// managed child. All native boundaries are injected for unit testing.
import { stopOwnedProcess, type StopRuntime } from "./postgres";
import type { OwnedProcess } from "./contracts";
import type { LaunchedServer } from "./server";

export interface LifecycleDeps {
  sleep: (ms: number) => Promise<void>;
  signalPid?: (pid: number, signal: NodeJS.Signals) => void;
  /** Grace period between SIGTERM and SIGKILL escalation; production 5000ms. */
  serverStopTimeoutMs?: number;
}

function defaultSignal(pid: number, signal: NodeJS.Signals): void {
  process.kill(pid, signal);
}

export class ServiceLifecycle {
  private server: LaunchedServer | null = null;
  private database: {
    process: OwnedProcess;
    runtime: StopRuntime;
  } | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly signalPid: (pid: number, signal: NodeJS.Signals) => void;
  private readonly serverStopTimeoutMs: number;

  constructor(deps: LifecycleDeps) {
    this.sleep = deps.sleep;
    this.signalPid = deps.signalPid ?? defaultSignal;
    this.serverStopTimeoutMs = deps.serverStopTimeoutMs ?? 5000;
  }

  /** The server this lifecycle currently owns (crash-watch identity). */
  get currentServer(): LaunchedServer | null {
    return this.server;
  }

  attachServer(server: LaunchedServer | null): void {
    this.server = server;
  }

  attachDatabase(process: OwnedProcess | null, runtime: StopRuntime | null): void {
    this.database = process && runtime ? { process, runtime } : null;
  }

  /** Stop the application server if one is owned. Serialized, idempotent. */
  stopServer(): Promise<void> {
    return this.enqueue(() => this.stopServerNow());
  }

  /** Stop the owned database if one is attached. Serialized, idempotent. */
  stopDatabase(): Promise<void> {
    return this.enqueue(() => this.stopDatabaseNow());
  }

  /** Stop server first, then database. Restart/reset/quit share this path. */
  shutdown(): Promise<void> {
    return this.enqueue(async () => {
      await this.stopServerNow();
      await this.stopDatabaseNow();
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async stopServerNow(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    server.kill();
    // Disarm escalation once the server is gone: signaling a possibly
    // recycled PID after a clean exit would hit an unrelated process.
    let exited = false;
    const escalation = this.sleep(this.serverStopTimeoutMs).then(() => {
      if (!exited) {
        try {
          this.signalPid(server.pid, "SIGKILL");
        } catch {
          // Already gone; the exited promise below still settles the wait.
        }
      }
    });
    try {
      await Promise.race([server.exited, escalation]);
    } finally {
      exited = true;
    }
  }

  private async stopDatabaseNow(): Promise<void> {
    const database = this.database;
    this.database = null;
    if (!database) return;
    try {
      await stopOwnedProcess(database.process, database.runtime);
    } catch {
      try {
        database.process.kill();
      } catch {
        // Best effort: nothing left to signal.
      }
    }
  }
}
