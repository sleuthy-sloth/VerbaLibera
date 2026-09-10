#!/usr/bin/env tsx
/**
 * Deployment guard: production TypeScript must not import from directories
 * excluded by .vercelignore.
 *
 * Two Vercel build failures came from `src/features/listen/tracks.ts`
 * importing data that lived under `services/voice`, which .vercelignore
 * excludes from the uploaded build context. The import resolved locally and
 * typechecked, then vanished on Vercel. This script fails locally, before
 * deploy, with the offending file and the ignored path it reached into.
 *
 * Usage: tsx scripts/check-deployment-imports.ts [--json]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = process.cwd();
const IGNORE_FILE = ".vercelignore";
const SOURCE_DIRS = ["src", "scripts", "desktop"];
const EXTENSIONS = /\.(ts|tsx|mts|cts)$/;

type IgnoreRule = { raw: string; negate: boolean; test: (p: string) => boolean };

function parseIgnoreFile(contents: string): IgnoreRule[] {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((raw) => {
      const negate = raw.startsWith("!");
      const pattern = negate ? raw.slice(1) : raw;
      return { raw, negate, pattern };
    })
    .map(({ raw, negate, pattern }) => {
      // A trailing slash or a bare name matches that directory and everything
      // under it; `*` is a single-segment wildcard, `**` matches any depth.
      const anchored = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
      const segments = anchored.split("/");
      return {
        raw,
        negate,
        test: (p: string) => {
          const parts = p.split(sep);
          const matchesAt = (start: number): boolean => {
            for (let i = 0; i < segments.length; i++) {
              const seg = segments[i];
              const target = parts[start + i];
              if (target === undefined) return false;
              if (seg === "**") return true;
              if (seg === "*") continue;
              if (seg !== target) return false;
            }
            return true;
          };
          // Directory rules match the directory itself and its contents.
          for (let start = 0; start < parts.length; start++)
            if (matchesAt(start)) return true;
          return false;
        },
      };
    });
}

const IMPORT_PATTERNS = [
  // import ... from "..." / export ... from "..." / import("...")
  /(?:from\s*|import\s*\(\s*|require\s*\(\s*)(["'])([^"']+)\1/g,
  // side-effect import "..."
  /(?:^|\n)\s*import\s+(["'])([^"']+)\1/g,
];

function isRelative(spec: string): boolean {
  return spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/");
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.test(entry)) yield full;
  }
}

function sourceFiles(): string[] {
  return SOURCE_DIRS.filter((d) => existsSync(d)).flatMap((d) => [...walk(d)]);
}

/** Resolve an import specifier to a repo-relative path, or null if external. */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) {
    const candidate = join("src", spec.slice(2));
    return existsSync(candidate) || existsSync(`${candidate}.ts`) || existsSync(`${candidate}.tsx`)
      ? candidate
      : null;
  }
  if (!isRelative(spec)) return null;
  const base = spec.startsWith("/") ? join(ROOT, spec) : resolve(dirname(fromFile), spec);
  const rel = relative(ROOT, base);
  if (rel.startsWith("..") || rel.startsWith(sep)) return null;
  return rel;
}

function main(): void {
  if (!existsSync(IGNORE_FILE)) {
    console.log("No .vercelignore found; nothing to check.");
    return;
  }
  const rules = parseIgnoreFile(readFileSync(IGNORE_FILE, "utf8"));
  const ignored = (p: string): boolean => {
    let result = false;
    for (const rule of rules) result = rule.negate ? result && !rule.test(p) : result || rule.test(p);
    return result;
  };

  const violations: Array<{ file: string; spec: string; target: string; rule: string }> = [];
  for (const file of sourceFiles()) {
    const contents = readFileSync(file, "utf8");
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(contents)) !== null) {
        const spec = match[2];
        const target = resolveLocal(file, spec);
        if (!target) continue;
        if (!ignored(target)) continue;
        const rule = rules.find((r) => !r.negate && r.test(target))?.raw ?? target;
        violations.push({ file: relative(ROOT, file), spec, target, rule });
      }
    }
  }

  if (violations.length === 0) {
    console.log("Deployment imports: OK (no production import reaches an ignored path).");
    return;
  }
  console.error(
    `Deployment imports: ${violations.length} violation(s). These imports resolve locally but are excluded from the Vercel build context.`,
  );
  for (const v of violations)
    console.error(
      `  ${v.file} imports "${v.spec}" -> ${v.target} (excluded by .vercelignore rule "${v.rule}")`,
    );
  console.error(
    "\nRuntime data must live in a directory that ships (e.g. src/features/listen/generated/), not in an authoring directory.",
  );
  process.exit(1);
}

main();
