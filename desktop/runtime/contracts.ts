// Shared contracts for the desktop runtime (Task 4).
// Native boundaries (process spawn, entropy, clock, ports, database access)
// are dependency-injected so lifecycle, security, and failure branches can
// be unit tested without launching services.

export interface SpawnResult {
  pid: number;
  exitCode?: number;
}

export type SpawnFn = (
  cmd: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv },
) => Promise<SpawnResult>;

export interface OwnedProcess {
  pid: number;
  databaseUrl: string;
  dataDir: string;
  port: number;
  /** The password securing this cluster; persist encrypted, never log. */
  password: string;
  kill: () => void;
}

export interface PostgresContext {
  /** Directory holding the staged postgres/initdb/pg_ctl/psql binaries. */
  runtimeBinDir: string;
  /** User-data root; the cluster lives in `<dataRoot>/pgdata`. */
  dataRoot: string;
  /**
   * Reuse this password for an existing cluster (decrypted from the
   * safeStorage envelope). Omit on first setup to generate a fresh one;
   * the caller persists `generatedPassword` from the result.
   */
  password?: string;
  spawn: SpawnFn;
  randomBytes: (n: number) => Buffer;
  allocPort: () => Promise<number>;
  /** Credentialed readiness probe (`SELECT 1`); true when serving. */
  probe: (databaseUrl: string) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
  /**
   * Signal the postmaster when graceful `pg_ctl stop` fails. Defaults to
   * `process.kill`; inject a spy in tests. Never targets another program:
   * callers pass only the PID read from this cluster's postmaster.pid.
   */
  signal?: (pid: number, signal: NodeJS.Signals) => void;
}

export interface ProcessRecord {
  pid: number;
  executable: string;
  startedAt: string;
}

export interface ProcessInspector {
  commandOf: (pid: number) => Promise<string | null>;
  startTimeOf: (pid: number) => Promise<string | null>;
}
