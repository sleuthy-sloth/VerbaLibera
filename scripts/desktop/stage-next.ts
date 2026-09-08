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
  stagePrismaConfigShim(stageRoot);
  neutralizeBuildMachineRoot(serverEntry, repoRoot);
  neutralizeRequiredServerFiles(path.join(stageRoot, ".next/required-server-files.json"), repoRoot);
  stripSourceMaps(stageRoot);
  neutralizeStagedRepoPaths(stageRoot, repoRoot);
  stagePrismaCli(repoRoot);
  stageSeedRuntimeDeps(repoRoot, stageRoot);
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
 * Replaces remaining build-machine checkout roots inside staged Next.js
 * output (font-manifest importer paths, chunk debug sources) with a stable
 * placeholder. These strings are inert metadata — stack-trace sources and
 * font bookkeeping — never load paths, so rewriting them cannot change
 * runtime file resolution. Structured manifests that must stay parseable
 * (required-server-files.json, *.nft.json) are excluded; they are covered
 * by their own key-scoped neutralization. Returns files rewritten.
 */
const NEUTRAL_BUILD_ROOT = "/verbalibera-build-root";

export function neutralizeStagedRepoPaths(
  stageRoot: string,
  repoRoot: string,
): number {
  let rewritten = 0;
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const base = path.basename(full);
      if (
        !full.endsWith(".js") &&
        !base.startsWith("next-font-manifest")
      ) {
        continue;
      }
      let content: string;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      if (!content.includes(repoRoot)) continue;
      fs.writeFileSync(full, content.split(repoRoot).join(NEUTRAL_BUILD_ROOT));
      rewritten += 1;
    }
  }
  walk(path.join(stageRoot, ".next"));
  return rewritten;
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
 * The staged prisma.config.ts imports `prisma/config`, but the staged server
 * dir has no node_modules of its own — and Node resolves the specifier from
 * the config file, not from the CLI entry. Without this shim a packaged
 * launch crashes with `Cannot find module 'prisma/config'` (masked in-repo
 * because resolution walks up to the repo's node_modules). The shim
 * re-exports the staged CLI's real `prisma/config` via a relative require,
 * so its own `@prisma/*` deps keep resolving inside prisma-cli/node_modules.
 */
function stagePrismaConfigShim(stageRoot: string): void {
  const shimDir = path.join(stageRoot, "node_modules", "prisma");
  fs.mkdirSync(shimDir, { recursive: true });
  fs.writeFileSync(
    path.join(shimDir, "package.json"),
    JSON.stringify({ name: "prisma", exports: { "./config": "./config.js" } }),
  );
  fs.writeFileSync(
    path.join(shimDir, "config.js"),
    'module.exports = require("../../../prisma-cli/node_modules/prisma/config.js");\n',
  );
}

/**
 * Copies the transitive `dependencies` closure of already-staged root
 * packages from the repo's node_modules into destModules. Roots must be
 * copied first; the walk then pulls whatever their manifests name.
 * (Third-party deps like `effect`, required by `@prisma/config`, arrive
 * this way — without them the staged CLI crashes MODULE_NOT_FOUND.)
 */
function copyStagedDependencyClosure(
  repoRoot: string,
  destModules: string,
  roots: string[],
): void {
  const queue: string[] = [...roots];
  const staged = new Set<string>(roots);
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
      // Type-only packages never load at runtime; keep the shipped tree lean.
      if (dep.startsWith("@types/")) continue;
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
  copyStagedDependencyClosure(repoRoot, destModules, queue);
}

/**
 * The staged seed bundle marks `@prisma/client`, `@prisma/adapter-pg`, and
 * `pg` external, so they must resolve from the staged server dir at seed
 * time. Packaged first runs died here with ERR_MODULE_NOT_FOUND after
 * migrate succeeded. Roots are copied from the repo; the closure walker
 * pulls the rest (pg-protocol, postgres-array, driver-adapter-utils, ...).
 */
const SEED_RUNTIME_ROOTS = ["@prisma/client", "@prisma/adapter-pg", "pg"];

function stageSeedRuntimeDeps(repoRoot: string, stageRoot: string): void {
  const destModules = path.join(stageRoot, "node_modules");
  for (const name of SEED_RUNTIME_ROOTS) {
    const source = path.join(repoRoot, "node_modules", name);
    if (!fs.existsSync(source)) {
      throw new Error(`Seed runtime root missing: ${source}.`);
    }
    fs.cpSync(source, path.join(destModules, name), {
      recursive: true,
      filter: (entry) => !entry.endsWith(".map"),
    });
  }
  copyStagedDependencyClosure(repoRoot, destModules, SEED_RUNTIME_ROOTS);
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
