// Packaged Prisma migration runner (Task 6).
// Runs `migrate deploy` through the bundled Prisma CLI + darwin-arm64
// schema engine, then the staged idempotent seed bundle. DATABASE_URL is
// passed only in the child environment, never logged.
import { execFile } from "node:child_process";
import type { MigrationRunner } from "../runtime/migrations";

export interface PackagedCommand {
  bin: string;
  args: string[];
}

export interface PrismaRunnerPaths {
  /** Bundled `prisma migrate deploy` command. */
  migrate: PackagedCommand;
  /** Staged idempotent seed command. */
  seed: PackagedCommand;
  /** Staged psql for read-only migration inspection. */
  psqlBin: string;
}

function run(
  bin: string,
  args: string[],
  databaseUrl: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { env: { ...process.env, DATABASE_URL: databaseUrl } },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(`packaged command failed: ${String(stderr || error)}`),
          );
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

export function createPrismaRunner(paths: PrismaRunnerPaths): MigrationRunner {
  return {
    deploy: async (databaseUrl: string) => {
      await run(paths.migrate.bin, [...paths.migrate.args, "deploy"], databaseUrl);
    },
    seed: async (databaseUrl: string) => {
      await run(paths.seed.bin, paths.seed.args, databaseUrl);
    },
    listApplied: async (databaseUrl: string) => {
      try {
        const { stdout } = await run(
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
