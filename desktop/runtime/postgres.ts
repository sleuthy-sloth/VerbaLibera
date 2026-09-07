// Local PostgreSQL lifecycle for the desktop app (Task 4).
// Initializes a loopback-only cluster with generated SCRAM credentials,
// starts it via the packaged pg_ctl, and verifies readiness with a
// credentialed SELECT 1. All native boundaries come from PostgresContext.
import fs from "node:fs";
import path from "node:path";
import type { OwnedProcess, PostgresContext } from "./contracts";

const DB_USER = "verbalibera";
const DB_NAME = "verbalibera";
const READINESS_ATTEMPTS = 30;

function bin(context: PostgresContext, name: string): string {
  return path.join(context.runtimeBinDir, name);
}

export async function startLocalPostgres(
  context: PostgresContext,
): Promise<OwnedProcess> {
  const dataDir = path.join(context.dataRoot, "pgdata");
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dataDir, 0o700);

  const password = context.password ?? context.randomBytes(32).toString("base64url");
  const port = await context.allocPort();

  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    const pwFile = path.join(context.dataRoot, ".pwfile");
    fs.writeFileSync(pwFile, password, { mode: 0o600 });
    try {
      await context.spawn(
        bin(context, "initdb"),
        [
          "-D",
          dataDir,
          "-U",
          DB_USER,
          "-E",
          "UTF8",
          "--auth=scram-sha-256",
          `--pwfile=${pwFile}`,
        ],
        {},
      );
    } finally {
      fs.rmSync(pwFile, { force: true });
    }
  }

  const logFile = path.join(context.dataRoot, "postgres.log");
  await context.spawn(
    bin(context, "pg_ctl"),
    [
      "start",
      "-D",
      dataDir,
      "-l",
      logFile,
      "-o",
      `-c listen_addresses=127.0.0.1 -c port=${port}`,
      "-w",
      "-t",
      "30",
    ],
    {},
  );

  const databaseUrl =
    `postgresql://${DB_USER}:${password}@127.0.0.1:${port}/${DB_NAME}`;
  // The application database is created later by `migrate deploy`; readiness
  // probes the always-present postgres maintenance database instead.
  const probeUrl = new URL(databaseUrl);
  probeUrl.pathname = "/postgres";
  for (let attempt = 0; attempt < READINESS_ATTEMPTS; attempt += 1) {
    if (await context.probe(probeUrl.toString())) break;
    if (attempt === READINESS_ATTEMPTS - 1) {
      throw Object.assign(
        new Error("Local database did not become ready."),
        { code: "LOCAL_DATABASE_UNREADY" },
      );
    }
    await context.sleep(500);
  }

  // pg_ctl exits after forking; the real postmaster PID is recorded here.
  let pid = 0;
  try {
    const [firstLine] = fs
      .readFileSync(path.join(dataDir, "postmaster.pid"), "utf8")
      .split("\n");
    pid = Number.parseInt(firstLine ?? "0", 10) || 0;
  } catch {
    pid = 0;
  }

  return {
    pid,
    databaseUrl,
    dataDir,
    port,
    password,
    kill: () => {
      // pg_ctl exits after forking, so this is the only handle on the real
      // postmaster. A no-op here used to leave the cluster running after a
      // failed `pg_ctl stop`.
      if (pid > 0) {
        const signal = context.signal ?? ((target, sig) => process.kill(target, sig));
        try {
          signal(pid, "SIGTERM");
        } catch {
          // Already stopped.
        }
      }
    },
  };
}

export interface StopRuntime {
  spawn: PostgresContext["spawn"];
  runtimeBinDir: string;
}

export async function stopOwnedProcess(
  process: OwnedProcess,
  runtime: StopRuntime,
): Promise<void> {
  try {
    await runtime.spawn(
      path.join(runtime.runtimeBinDir, "pg_ctl"),
      ["stop", "-D", process.dataDir, "-m", "fast", "-t", "30"],
      {},
    );
  } catch {
    process.kill();
  }
}
