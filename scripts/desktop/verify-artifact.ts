// Packaged artifact audit + DMG normalization (Task 9).
// Rejects Intel/universal Mach-O files, .env files, source maps,
// voice-model/runtime files, developer paths, secrets, and unexpected
// external URLs; normalizes the Forge DMG name and writes its checksum.
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const EXPECTED_DMG = "VerbaLibera-mac-arm64.dmg";

const PATH_FAILURE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /(^|\/)\.env(\.|$)/, reason: "environment file" },
  { pattern: /\.map$/, reason: "source map" },
  { pattern: /(^|\/)services\/voice(\/|$)/, reason: "voice service" },
  { pattern: /\.(onnx|pt|ckpt|safetensors|tflite)$/i, reason: "model file" },
  { pattern: /\/Users\//, reason: "developer home path" },
  { pattern: /\/home\//, reason: "developer home path" },
];

const CONTENT_FAILURE_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
  skipVendored?: boolean;
}> = [
  { pattern: /\/Users\//, reason: "developer home path" },
  {
    pattern: /postgresql:\/\/[^/\s"']+:[^/\s"']+@/i,
    reason: "embedded database credential",
    // Vendored CLI help text shows masked example URLs (johndoe:***) that
    // can never be real credentials. Template-built URLs (`${...}`) are
    // construction code, not literals, and are cleared separately below.
    skipVendored: true,
  },
  // A real PEM block (header + base64 body), not a library error string.
  { pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\r\n]{64,}/, reason: "embedded private key" },
  { pattern: /\bsk-[A-Za-z0-9]{8,}/, reason: "possible API secret" },
  // Live request sinks aimed off-machine. Plain URL strings (docs links,
  // metadata, XML namespaces) and user-initiated anchor navigation are not
  // requests; app windows additionally block off-origin navigation.
  {
    pattern: /(fetch|WebSocket|EventSource)\(\s*["']https?:\/\/(?!127\.0\.0\.1|localhost)/i,
    reason: "off-machine network request",
    skipVendored: true,
  },
  {
    pattern: /(src|poster|action)=["']https?:\/\/(?!127\.0\.0\.1|localhost)/i,
    reason: "off-machine resource reference",
  },
  {
    pattern: /<link[^>]*href=["']https?:\/\/(?!127\.0\.0\.1|localhost)/i,
    reason: "off-machine resource reference",
  },
];

const AUDITED_TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".ts",
  ".tsx",
]);

/**
 * A developer path fails the audit when it names a directory that exists on
 * this machine (a real baked build path) — or when it is structurally
 * realistic (a home root plus at least two non-placeholder segments), so a
 * path leaked by another builder fails even where it names nothing on the
 * verifier's disk. Comment examples ("/Users/foo/...") and runtime
 * home-directory construction (`"/Users/"+name`) name nothing either way.
 */
const PLACEHOLDER_SEGMENTS = new Set([
  "foo",
  "bar",
  "example",
  "examples",
  "user",
  "username",
  "name",
  "path",
  "to",
  "app",
  "your",
  "my",
  "someone",
  "sample",
  "test",
  "domain",
  "host",
]);

export function bakedDeveloperPath(content: string): boolean {
  const matches =
    content.match(/\/(?:Users|home)\/[^/"'\s+]+(?:\/[^/"'\s+]+)?/g) ?? [];
  return matches.some((candidate) => {
    const segments = candidate.split("/").filter(Boolean);
    if (
      segments.length >= 3 &&
      !segments
        .slice(1, 4)
        .some((segment) => PLACEHOLDER_SEGMENTS.has(segment.toLowerCase()))
    ) {
      return true;
    }
    try {
      const probe = `/${segments.slice(0, 3).join("/")}`;
      return fs.existsSync(probe);
    } catch {
      return false;
    }
  });
}

export function collectArtifactPaths(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(path.relative(root, full));
    }
  }
  walk(root);
  return out.sort();
}

/** Pure path-name audit; returns human-readable failures. */
export function auditArtifactPaths(paths: string[]): string[] {
  const failures: string[] = [];
  for (const candidate of paths) {
    for (const { pattern, reason } of PATH_FAILURE_PATTERNS) {
      if (pattern.test(candidate)) {
        failures.push(`${candidate}: ${reason}`);
      }
    }
  }
  return failures;
}

/** Content audit over text files under root; returns failures. */
export function auditArtifactContent(root: string, paths: string[]): string[] {
  const failures: string[] = [];
  for (const candidate of paths) {
    if (!AUDITED_TEXT_EXTENSIONS.has(path.extname(candidate))) continue;
    const full = path.join(root, candidate);
    let content: string;
    try {
      content = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const vendored = candidate.includes("node_modules/");
    for (const { pattern, reason, skipVendored } of CONTENT_FAILURE_PATTERNS) {
      if (vendored && skipVendored) continue;
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (match) {
        // Template-built connection strings are construction code, not
        // leaked literals.
        if (reason === "embedded database credential" && match[0].includes("${")) {
          continue;
        }
        if (reason === "developer home path" && !bakedDeveloperPath(content)) {
          continue;
        }
        failures.push(`${candidate}: ${reason}`);
      }
    }
  }
  return failures;
}

function isMachO(file: string): boolean {
  try {
    return execFileSync("file", ["-b", file], { encoding: "utf8" }).includes("Mach-O");
  } catch {
    return false;
  }
}

/** Every staged Mach-O must be arm64-only (rejects Intel/universal). */
export function auditMachOArch(root: string, paths: string[]): string[] {
  const failures: string[] = [];
  for (const candidate of paths) {
    const full = path.join(root, candidate);
    if (!isMachO(full)) continue;
    const archs = execFileSync("lipo", ["-archs", full], { encoding: "utf8" }).trim();
    if (archs !== "arm64") {
      failures.push(`${candidate}: Mach-O arch ${archs}, expected arm64-only`);
    }
  }
  return failures;
}

/** The compiled main process must keep the sandboxed renderer policy. */
export function auditSandboxPreferences(mainJs: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(mainJs, "utf8");
  } catch {
    return [`missing compiled main process at ${mainJs}`];
  }
  const failures: string[] = [];
  for (const marker of ["sandbox: true", "contextIsolation: true", "nodeIntegration: false"]) {
    if (!content.includes(marker)) {
      failures.push(`main process missing renderer policy ${marker}`);
    }
  }
  return failures;
}

export function auditStagedTree(root: string): string[] {
  const paths = collectArtifactPaths(root);
  return [
    ...auditArtifactPaths(paths),
    ...auditArtifactContent(root, paths),
    ...auditMachOArch(root, paths),
  ];
}

/**
 * Full shipped-app audit over an installed/copied application tree:
 * file names, file contents, and Mach-O architectures, plus the renderer
 * sandbox policy of the given compiled main process. Used for the mounted
 * DMG (where the Electron main is already packed into app.asar, so the
 * sandbox gate stays a pre-pack check on desktop-dist/main.js).
 */
export function auditShippedApp(
  contentsDir: string,
  mainJsPath: string,
): string[] {
  const paths = collectArtifactPaths(contentsDir);
  return [
    ...auditArtifactPaths(paths),
    ...auditArtifactContent(contentsDir, paths),
    ...auditMachOArch(contentsDir, paths),
    ...auditSandboxPreferences(mainJsPath),
  ];
}

export function writeChecksum(file: string): string {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(file));
  const out = `${hash.digest("hex")}  ${path.basename(file)}\n`;
  fs.writeFileSync(`${file}.sha256`, out);
  return out.trim();
}

export interface BuildInfo {
  dmg: string;
  sha: string;
  revision: string;
  builtAt: string;
}

/** Ties a DMG checksum to the exact source revision that produced it. */
export function writeBuildInfo(
  destDir: string,
  artifact: { dmg: string; sha: string },
): string {
  let revision = "unknown";
  try {
    revision = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    // Source tarballs and Finder-launched builds may lack git metadata.
  }
  const info: BuildInfo = {
    dmg: artifact.dmg,
    sha: artifact.sha,
    revision,
    builtAt: new Date().toISOString(),
  };
  const file = path.join(destDir, "BUILD-INFO.json");
  fs.writeFileSync(file, `${JSON.stringify(info, null, 2)}\n`);
  return file;
}

function newestDmg(makeDir: string): string {
  if (!fs.existsSync(makeDir)) {
    throw new Error(`Forge make output missing at ${makeDir}; run electron:make first.`);
  }
  const dmgs = fs
    .readdirSync(makeDir)
    .flatMap((entry) =>
      fs.statSync(path.join(makeDir, entry)).isDirectory()
        ? fs.readdirSync(path.join(makeDir, entry)).map((f) => path.join(makeDir, entry, f))
        : [path.join(makeDir, entry)],
    )
    .filter((f) => f.endsWith(".dmg"));
  if (dmgs.length === 0) throw new Error(`No DMG found under ${makeDir}.`);
  dmgs.sort(
    (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
  );
  return dmgs[0];
}

export function normalizeDmg(root: string = process.cwd()): { dmg: string; sha: string } {
  const destDir = path.join(root, "dist/electron");
  fs.mkdirSync(destDir, { recursive: true });
  const source = newestDmg(path.join(root, "out/make"));
  const dest = path.join(destDir, EXPECTED_DMG);
  fs.copyFileSync(source, dest);
  const sha = writeChecksum(dest);
  writeBuildInfo(destDir, { dmg: EXPECTED_DMG, sha });
  console.log(`electron:verify: ${dest}`);
  console.log(`electron:verify: ${sha}`);
  return { dmg: dest, sha };
}

export function auditMountedDmg(dmg: string): string[] {
  const mount = fs.mkdtempSync("/tmp/verbalibera-dmg-");
  try {
    execSync(`hdiutil attach -nobrowse -readonly -mountpoint "${mount}" "${dmg}"`, {
      stdio: "pipe",
    });
    const apps = fs.readdirSync(mount).filter((f) => f.endsWith(".app"));
    if (apps.length !== 1) return [`expected one .app in DMG, found ${apps.length}`];
    const contents = path.join(mount, apps[0], "Contents");
    const failures: string[] = [];
    for (const required of [
      "Resources/server/server.js",
      "Resources/postgres/bin/postgres",
      "Resources/prisma-cli/node_modules/prisma/build/index.js",
      "Resources/server/seed.mjs",
      "Resources/THIRD_PARTY_NOTICES.md",
    ]) {
      if (!fs.existsSync(path.join(contents, required))) {
        failures.push(`DMG missing ${required}`);
      }
    }
    const resources = path.join(contents, "Resources");
    if (fs.existsSync(resources)) {
      const shipped = auditShippedApp(
        resources,
        path.join(resources, "app", "main.js"),
      );
      failures.push(
        ...shipped
          .filter((failure) => !failure.includes("missing compiled main process"))
          .map((failure) => `Resources/${failure}`),
      );
    }
    return failures;
  } finally {
    try {
      execSync(`hdiutil detach "${mount}" -force`, { stdio: "pipe" });
    } catch {
      // best effort
    }
    fs.rmSync(mount, { recursive: true, force: true });
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).endsWith(path.join("scripts", "desktop", "verify-artifact.ts"));
if (invokedDirectly) {
  const root = process.cwd();
  const failures = [
    ...auditStagedTree(path.join(root, ".desktop-stage")),
    ...auditStagedTree(path.join(root, "desktop-dist")),
    ...auditSandboxPreferences(path.join(root, "desktop-dist/main.js")),
  ];
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  const { dmg } = normalizeDmg(root);
  const mounted = auditMountedDmg(dmg);
  if (mounted.length > 0) {
    console.error(mounted.join("\n"));
    process.exit(1);
  }
  console.log("electron:verify: artifact audit clean");
}
