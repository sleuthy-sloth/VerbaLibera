// Shared contracts for the desktop runtime (Task 4).
// Native boundaries (process spawn, entropy, clock, ports, database access)
// are dependency-injected so lifecycle, security, and failure branches can
// be unit tested without launching services.

export interface SpawnResult {
  pid: number;
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
  kill: () => void;
}

export interface PostgresContext {
  /** Directory holding the staged postgres/initdb/pg_ctl/psql binaries. */
  runtimeBinDir: string;
  /** User-data root; the cluster lives in `<dataRoot>/pgdata`. */
  dataRoot: string;
  spawn: SpawnFn;
  randomBytes: (n: number) => Buffer;
  allocPort: () => Promise<number>;
  /** Credentialed readiness probe (`SELECT 1`); true when serving. */
  probe: (databaseUrl: string) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
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
