// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  auditArtifactContent,
  auditArtifactPaths,
  auditSandboxPreferences,
  bakedDeveloperPath,
  collectArtifactPaths,
} from "../scripts/desktop/verify-artifact";

function fixture(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-audit-"));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

describe("desktop artifact audit", () => {
  it("rejects environment files, source maps, and voice/model payloads", () => {
    const failures = auditArtifactPaths([
      "Resources/server/.env",
      "Resources/server/app.js.map",
      "Resources/services/voice/model.bin",
      "Resources/weights/model.onnx",
      "Resources/server/server.js",
    ]);
    expect(failures.join("\n")).toMatch(/environment file/);
    expect(failures.join("\n")).toMatch(/source map/);
    expect(failures.join("\n")).toMatch(/voice service/);
    expect(failures.join("\n")).toMatch(/model file/);
    expect(failures.some((f) => f.startsWith("Resources/server/server.js"))).toBe(false);
  });

  it("flags baked developer paths but ignores comment examples", () => {
    expect(bakedDeveloperPath('root "/Users/spkoehl/Documents/ChatGPT/x"')).toBe(true);
    expect(bakedDeveloperPath('// e.g. "/Users/foo/APP/.next/x"')).toBe(false);
    expect(bakedDeveloperPath('r||"/Users/"+n')).toBe(false);
  });

  it("flags real credentials and live off-machine sinks", () => {
    const dir = fixture({
      "bad.js": 'const url = "postgresql://u:s3cret@host/db"; fetch("https://api.example.com/x");',
      "good.js": 'fetch("http://127.0.0.1:43127/api/desktop/health");',
    });
    const failures = auditArtifactContent(dir, ["bad.js", "good.js"]);
    expect(failures.join("\n")).toMatch(/embedded database credential/);
    expect(failures.join("\n")).toMatch(/off-machine network request/);
    expect(failures.some((f) => f.startsWith("good.js"))).toBe(false);
  });

  it("requires the sandboxed renderer policy in the compiled main process", () => {
    const dir = fixture({
      "main.js": "webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }",
      "open.js": "webPreferences: { sandbox: false }",
    });
    expect(auditSandboxPreferences(path.join(dir, "main.js"))).toEqual([]);
    expect(auditSandboxPreferences(path.join(dir, "open.js")).length).toBeGreaterThan(0);
    expect(auditSandboxPreferences(path.join(dir, "missing.js")).length).toBeGreaterThan(0);
  });

  it("collects every staged file for auditing", () => {
    const dir = fixture({ "a/b.txt": "x", "c.txt": "y" });
    expect(collectArtifactPaths(dir)).toEqual(["a/b.txt", "c.txt"]);
  });
});
