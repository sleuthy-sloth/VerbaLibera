// Packaged Prisma migration runner (Task 6).
// Runs `migrate deploy` through the bundled Prisma CLI + darwin-arm64
// schema engine, then the staged idempotent seed bundle. DATABASE_URL is
// passed only in the child environment, never logged.
import { spawn } from "node:child_process";
import type { MigrationRunner } from "../runtime/migrations";

export interface PackagedCommand {
  bin: string;
  args: string[];
  env?: Record<string, string>;
  /**
   * Working directory for config-relative resolution (Prisma reads
   * prisma.config.ts and prisma/ relative to cwd). The staged server dir,
   * so Finder launches never depend on the launch directory.
   */
  cwd?: string;
}

export interface PrismaRunnerPaths {
  /** Bundled `prisma migrate deploy` command. */
  migrate: PackagedCommand;
  /** Staged idempotent seed command. */
  seed: PackagedCommand;
  /** Staged psql for read-only migration inspection. */
  psqlBin: string;
}

export function runChild(
  bin: string,
  args: string[],
  databaseUrl: string,
  extraEnv: Record<string, string> = {},
  cwd?: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env: {
        ...process.env,
        ...extraEnv,
        DATABASE_URL: databaseUrl,
        // The desktop main process runs inside Electron, where
        // process.execPath is the Electron binary. Children that must run
        // as plain Node (Prisma CLI, seed bundle) need this flag.
        ELECTRON_RUN_AS_NODE: "1",
      },
      // Closed stdin: engine grandchildren must never block on an
      // inherited pipe that nobody writes to.
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180_000,
      ...(cwd === undefined ? {} : { cwd }),
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `packaged command failed (${bin}): ${stderr.slice(-2000)} ${stdout.slice(-2000)}`.trim(),
        ),
      );
    });
  });
}

export function createPrismaRunner(paths: PrismaRunnerPaths): MigrationRunner {
  return {
    deploy: async (databaseUrl: string) => {
      await runChild(paths.migrate.bin, [...paths.migrate.args, "deploy"], databaseUrl, paths.migrate.env, paths.migrate.cwd);
    },
    seed: async (databaseUrl: string) => {
      await runChild(paths.seed.bin, paths.seed.args, databaseUrl, paths.seed.env, paths.seed.cwd);
    },
    listApplied: async (databaseUrl: string) => {
      try {
        const { stdout } = await runChild(
          paths.psqlBin,
          [
            databaseUrl,
            "-tAc",
            "SELECT migration_name FROM _prisma_migrations ORDER BY 1",
          ],
          databaseUrl,
        );
        return stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
      } catch {
        return [];
      }
    },
  };
}
