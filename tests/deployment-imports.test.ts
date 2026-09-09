import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const GUARD = "scripts/check-deployment-imports.ts";

/** Run the guard against a throwaway project that mirrors this repo's rules. */
function runGuardInTemp(files: Record<string, string>): { code: number; output: string } {
  const root = mkdtempSync(join(tmpdir(), "deploy-guard-"));
  try {
    writeFileSync(join(root, ".vercelignore"), "services/voice\n.next\n.env*\n");
    for (const [name, contents] of Object.entries(files)) {
      const target = join(root, name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    try {
      const output = execFileSync(
        "npx",
        ["tsx", join(process.cwd(), GUARD)],
        { cwd: root, encoding: "utf8", stdio: "pipe" },
      );
      return { code: 0, output };
    } catch (error) {
      const err = error as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? 1, output: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("deployment import guard", () => {
  it("passes when no production import reaches an ignored directory", () => {
    const result = runGuardInTemp({
      "src/features/listen/tracks.ts":
        'import data from "./generated/italian.json";\nexport const x = data;\n',
      "src/features/listen/generated/italian.json": "[]\n",
    });
    expect(result.code).toBe(0);
    expect(result.output).toContain("OK");
  });

  it("fails and names the file when a production import reaches services/voice", () => {
    // The historical Vercel failure: an authoring-only transcript imported
    // from src/. It typechecked locally, then vanished in the build context.
    const result = runGuardInTemp({
      "src/features/listen/tracks.ts":
        'import t from "../../../services/voice/scripts/transcript.json";\nexport const x = t;\n',
      "services/voice/scripts/transcript.json": "{}\n",
    });
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("src/features/listen/tracks.ts");
    expect(result.output).toContain("services/voice");
  });

  it("ignores external packages and unrelated relative imports", () => {
    const result = runGuardInTemp({
      "src/app/page.tsx":
        'import Link from "next/link";\nimport { a } from "./shared";\nimport { b } from "@/features/listen/generated/italian.json";\nexport default function P() { return a + b + String(Link); }\n',
      "src/app/shared.ts": "export const a = 1;\n",
      "src/features/listen/generated/italian.json": "[]\n",
    });
    expect(result.code).toBe(0);
  });
});
