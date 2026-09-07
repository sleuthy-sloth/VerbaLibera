// Verifies the staged PostgreSQL runtime closure (Task 3).
// Every staged Mach-O must be arm64-only, link only against system
// libraries or the staged runtime itself, and report version 18.6.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STAGE = path.join(process.cwd(), ".desktop-stage/postgres");

function fail(message: string): never {
  throw new Error(`postgres:verify: ${message}`);
}

function machOFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) machOFiles(full, out);
    else if (entry.isFile()) {
      try {
        const kind = execFileSync("file", ["-b", full], { encoding: "utf8" });
        if (kind.includes("Mach-O")) out.push(full);
      } catch {
        // ignore unreadable files
      }
    }
  }
  return out;
}

export function verifyPostgresRuntime(stage: string = STAGE): void {
  const bin = path.join(stage, "bin/postgres");
  if (!fs.existsSync(bin)) {
    fail(`missing staged postgres binary at ${bin}; run postgres:prepare`);
  }
  const version = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
  if (!version.includes("18.6")) {
    fail(`expected PostgreSQL 18.6, got: ${version}`);
  }
  if (!fs.existsSync(path.join(stage, "COPYRIGHT"))) {
    fail("missing PostgreSQL COPYRIGHT license file");
  }
  const binaries = machOFiles(path.join(stage, "bin")).concat(
    machOFiles(path.join(stage, "lib")),
  );
  if (binaries.length === 0) fail("no staged Mach-O binaries found");
  for (const file of binaries) {
    const archs = execFileSync("lipo", ["-archs", file], {
      encoding: "utf8",
    }).trim();
    if (archs !== "arm64") {
      fail(`${file} is ${archs}, expected arm64-only`);
    }
    const links = execFileSync("otool", ["-L", file], { encoding: "utf8" });
    for (const line of links.split("\n").slice(1)) {
      const dep = line.trim().split(" ")[0];
      if (!dep) continue;
      const system =
        dep.startsWith("/usr/lib/") || dep.startsWith("/System/");
      const staged = dep.startsWith("@rpath") || dep.includes(".desktop-stage");
      const stageLib =
        dep.startsWith(path.join(stage, "lib")) ||
        dep.startsWith("@executable_path") ||
        dep.startsWith("@loader_path");
      if (!system && !staged && !stageLib) {
        // Absolute build paths or Homebrew/MacPorts/developer locations leak here.
        if (
          dep.includes("/opt/homebrew") ||
          dep.includes("/opt/local") ||
          dep.includes("/usr/local") ||
          dep.includes("/Users/") ||
          dep.includes("/Applications/Xcode") ||
          dep.includes("/Library/Developer")
        ) {
          fail(`${file} links non-system dependency: ${dep}`);
        }
      }
    }
  }
  console.log(`postgres:verify: ${binaries.length} arm64 Mach-O files, ${version}`);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).endsWith(
    path.join("scripts", "desktop", "verify-postgres.ts"),
  );
if (invokedDirectly) {
  verifyPostgresRuntime();
}
