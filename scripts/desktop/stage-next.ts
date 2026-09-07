// Stages the Next.js standalone server for Electron packaging (Task 1).
// Copies `.next/standalone`, `.next/static`, `public`, Prisma migrations,
// and generated course packs into `.desktop-stage/server`, rejecting
// symlinks and any path that escapes the repository.
import fs from "node:fs";
import path from "node:path";

export const STAGE_DIR = ".desktop-stage/server";

const COPY_TREES: Array<{ from: string; to: string }> = [
  { from: ".next/standalone", to: "." },
  { from: ".next/static", to: ".next/static" },
  { from: "public", to: "public" },
  { from: "prisma/migrations", to: "prisma/migrations" },
  { from: "public/packs", to: "public/packs" },
];

function assertInsideRepo(root: string, candidate: string): void {
  const resolved = path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to stage path outside repository: ${candidate}`);
  }
}

function rejectExternalSymlinks(dir: string, sourceRoot: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) {
      const target = path.resolve(path.dirname(full), fs.readlinkSync(full));
      if (target !== sourceRoot && !target.startsWith(sourceRoot + path.sep)) {
        throw new Error(`Refusing to stage symlink escaping source: ${full}`);
      }
    } else if (stat.isDirectory()) {
      rejectExternalSymlinks(full, sourceRoot);
    }
  }
}

export function stageNextServer(root: string = process.cwd()): string {
  const repoRoot = path.resolve(root);
  const stageRoot = path.join(repoRoot, STAGE_DIR);
  for (const { from, to } of COPY_TREES) {
    assertInsideRepo(repoRoot, from);
    assertInsideRepo(repoRoot, path.join(STAGE_DIR, to));
    const source = path.join(repoRoot, from);
    if (!fs.existsSync(source)) continue;
    rejectExternalSymlinks(source, source);
    const dest = path.join(stageRoot, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(source, dest, { recursive: true, dereference: false });
  }
  const serverEntry = path.join(stageRoot, "server.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Standalone server entry missing at ${serverEntry}; run 'npm run build' first.`,
    );
  }
  neutralizeBuildMachineRoot(serverEntry, repoRoot);
  return stageRoot;
}

/**
 * Next.js bakes the build machine's repo root into standalone server.js
 * (`outputFileTracingRoot`, `repoRoot`, `turbopack.root`). Those absolute
 * paths are wrong on every learner machine, so rewrite them to `.`, which
 * resolves against the server's working directory when Electron launches it.
 */
export function neutralizeBuildMachineRoot(
  serverEntry: string,
  repoRoot: string,
): void {
  let content = fs.readFileSync(serverEntry, "utf8");
  const keys = ['"outputFileTracingRoot"', '"repoRoot"', '"turbopack":{"root"'];
  for (const key of keys) {
    const needle = `${key}:"${repoRoot}"`;
    if (!content.includes(needle)) {
      throw new Error(
        `Expected build-machine root for ${key} in staged server.js.`,
      );
    }
    content = content.split(needle).join(`${key}:"."`);
  }
  if (content.includes("/Users/") || content.includes("/home/")) {
    throw new Error("Staged server.js still contains a developer home path.");
  }
  fs.writeFileSync(serverEntry, content);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).endsWith(
    path.join("scripts", "desktop", "stage-next.ts"),
  );
if (invokedDirectly) {
  console.log(stageNextServer());
}
