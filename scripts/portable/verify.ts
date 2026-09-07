import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const REQUIRED_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src blob: data:",
  "media-src blob: data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
] as const;

export function auditPortableHtml(html: string): void {
  if (!html.startsWith("<!doctype html>")) {
    throw new Error("Portable artifact is missing its HTML doctype.");
  }
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) {
    throw new Error("Portable artifact contains an external executable script.");
  }
  if (/<link\b[^>]*\bhref\s*=/i.test(html)) {
    throw new Error("Portable artifact contains an external linked resource.");
  }
  if (/<(?:img|audio|video|source)\b[^>]*\bsrc\s*=\s*["'](?:https?:|\/)/i.test(html)) {
    throw new Error("Portable artifact contains an external media resource.");
  }
  const csp = html.match(
    /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(["'])(.*?)\1/i,
  )?.[2];
  if (!csp || REQUIRED_CSP.some((directive) => !csp.includes(directive))) {
    throw new Error("Portable artifact has an incomplete content security policy.");
  }
  if (/\/(?:Users|home)\/[^/\s"']+\//.test(html)) {
    throw new Error("Portable artifact contains a developer-machine path.");
  }
  if (/localhost|127\.0\.0\.1|\/api\//i.test(html)) {
    throw new Error("Portable artifact contains a server endpoint.");
  }
}

export function verifyPortableArtifact(
  path: string,
  options: { audit?: boolean } = {},
): string {
  const bytes = readFileSync(path);
  if (options.audit !== false) auditPortableHtml(bytes.toString("utf8"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  writeFileSync(`${path}.sha256`, `${digest}  ${basename(path)}\n`);
  return digest;
}

function main() {
  const artifact =
    process.argv[2] ??
    join(process.cwd(), "dist/portable/VerbaLibera-Portable.html");
  console.log(verifyPortableArtifact(artifact));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
