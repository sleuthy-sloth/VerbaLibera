// Stages the Next.js standalone server for Electron packaging (Task 1).
// Copies `.next/standalone`, `.next/static`, `public`, Prisma migrations,
// and generated course packs into `.desktop-stage/server`, rejecting
// symlinks and any path that escapes the repository.
import fs from "node:fs";
import path from "node:path";

export const STAGE_DIR = ".desktop-stage/server";
export const PRISMA_CLI_STAGE_DIR = ".desktop-stage/prisma-cli";
export const SEED_STAGE_DIR = ".desktop-stage/seed";

const COPY_TREES: Array<{ from: string; to: string }> = [
  { from: ".next/standalone", to: "." },
  { from: ".next/static", to: ".next/static" },
  { from: "public", to: "public" },
  { from: "prisma/migrations", to: "prisma/migrations" },
  // migrate deploy resolves prisma.config.ts and prisma/ relative to its
  // working directory; stage both so packaged runs never depend on cwd.
  { from: "prisma.config.ts", to: "prisma.config.ts" },
  { from: "prisma/schema.prisma", to: "prisma/schema.prisma" },
  { from: "public/packs", to: "public/packs" },
];

function assertInsideRepo(root: string, candidate: string): void {
  const resolved = path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Refusing to stage path outside repository: ${candidate}`);
  }
}

function rejectExternalSymlinks(dir: string, sourceRoot: string): void {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) {
    if (stat.isSymbolicLink()) {
      const resolved = path.resolve(path.dirname(dir), fs.readlinkSync(dir));
      if (resolved !== sourceRoot && !resolved.startsWith(sourceRoot + path.sep)) {
        throw new Error(`Refusing to stage external symlink: ${dir}`);
      }
    }
    return;
  }
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

export async function stageNextServer(root: string = process.cwd()): Promise<string> {
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
  const stagedConfig = path.join(stageRoot, "prisma.config.ts");
  if (fs.existsSync(stagedConfig)) stripStagedDotenvImport(stagedConfig);
  neutralizeBuildMachineRoot(serverEntry, repoRoot);
  neutralizeRequiredServerFiles(path.join(stageRoot, ".next/required-server-files.json"), repoRoot);
  stripSourceMaps(stageRoot);
  stagePrismaCli(repoRoot);
  await buildSeedBundle(repoRoot);
  return stageRoot;
}

/** Source maps are dev-only weight; drop them from the shipped tree. */
export function stripSourceMaps(stageRoot: string): number {
  let removed = 0;
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && full.endsWith(".map")) {
        fs.rmSync(full);
        removed += 1;
      }
    }
  }
  walk(stageRoot);
  return removed;
}

/**
 * Stages the Prisma CLI (`migrate deploy`) with only its migration closure:
 * the CLI package plus the engine packages it resolves at runtime. Studio,
 * client, and dev tools are excluded to keep the download small.
 */
const PRISMA_SCOPED_ALLOWLIST = [
  "engines",
  "engines-version",
  "debug",
  "fetch-engine",
  "get-platform",
  "config",
  "driver-adapter-utils",
];

/**
 * The staged prisma.config.ts runs with DATABASE_URL from the child
 * environment and no .env file is ever staged, so its `dotenv/config`
 * import is dead weight that would crash packaged migrate runs
 * (dotenv is a dev-only package). Strip that line from the staged copy;
 * the repository config is untouched.
 */
function stripStagedDotenvImport(stagedConfigPath: string): void {
  const lines = fs.readFileSync(stagedConfigPath, "utf8").split("\n");
  const kept = lines.filter((line) => !line.includes("dotenv/config"));
  if (kept.length !== lines.length) {
    fs.writeFileSync(stagedConfigPath, kept.join("\n"));
  }
}
/**
 * Copies the transitive third-party dependencies (e.g. `effect`, required
 * by `@prisma/config`) of the staged packages from the repo's node_modules.
 * Without this the staged CLI crashes with MODULE_NOT_FOUND on first run.
 */
function stagePrismaCliThirdPartyDeps(
  repoRoot: string,
  destModules: string,
): void {
  const queue: string[] = ["prisma"];
  const staged = new Set<string>(["prisma"]);
  for (const pkg of PRISMA_SCOPED_ALLOWLIST) {
    staged.add(`@prisma/${pkg}`);
    queue.push(`@prisma/${pkg}`);
  }
  while (queue.length > 0) {
    const name = queue.pop()!;
    const manifestPath = path.join(destModules, name, "package.json");
    let manifest: { dependencies?: Record<string, string> };
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    for (const dep of Object.keys(manifest.dependencies ?? {})) {
      if (staged.has(dep)) continue;
      const source = path.join(repoRoot, "node_modules", dep);
      if (!fs.existsSync(source)) continue;
      staged.add(dep);
      fs.cpSync(path.join(source), path.join(destModules, dep), {
        recursive: true,
        filter: (entry) => !entry.endsWith(".map"),
      });
      queue.push(dep);
    }
  }
}

export function stagePrismaCli(repoRoot: string): string {
  const dest = path.join(repoRoot, PRISMA_CLI_STAGE_DIR);
  fs.rmSync(dest, { recursive: true, force: true });
  const destModules = path.join(dest, "node_modules");
  fs.mkdirSync(path.join(destModules, "@prisma"), { recursive: true });
  const prismaSource = path.join(repoRoot, "node_modules/prisma");
  if (!fs.existsSync(prismaSource)) {
    throw new Error("Missing prisma in node_modules; run 'npm ci' first.");
  }
  fs.cpSync(prismaSource, path.join(destModules, "prisma"), {
    recursive: true,
    filter: (source) => !source.endsWith(".map"),
  });
  for (const pkg of PRISMA_SCOPED_ALLOWLIST) {
    const source = path.join(repoRoot, "node_modules/@prisma", pkg);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(destModules, "@prisma", pkg), {
      recursive: true,
      filter: (source) => !source.endsWith(".map"),
    });
  }
  const cliEntry = path.join(destModules, "prisma/build/index.js");
  if (!fs.existsSync(cliEntry)) {
    throw new Error(`Staged Prisma CLI entry missing at ${cliEntry}.`);
  }
  stagePrismaCliThirdPartyDeps(repoRoot, destModules);
  return dest;
}

/**
 * Bundles prisma/seed.ts into a single ESM file placed inside the staged
 * server directory, so its bare database-driver imports resolve from the
 * staged server's node_modules with no extra path configuration.
 */
export async function buildSeedBundle(repoRoot: string): Promise<string> {
  const { buildSync } = await import("esbuild");
  const outfile = path.join(repoRoot, STAGE_DIR, "seed.mjs");
  fs.rmSync(outfile, { force: true });
  buildSync({
    entryPoints: [path.join(repoRoot, "prisma/seed.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    alias: { "@": path.join(repoRoot, "src") },
    external: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  });
  return outfile;
}

/**
 * required-server-files.json carries the same baked build-machine roots as
 * server.js. Rewrite them to "." for the same reason (see above).
 */
export function neutralizeRequiredServerFiles(file: string, repoRoot: string): void {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  const replaced = content.split(repoRoot).join(".");
  if (/\/Users\/|\/home\//.test(replaced)) {
    throw new Error("required-server-files.json still contains a developer home path.");
  }
  fs.writeFileSync(file, replaced);
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
  stageNextServer().then(
    (dir) => console.log(dir),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
