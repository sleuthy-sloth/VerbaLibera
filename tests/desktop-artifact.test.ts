// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  auditArtifactContent,
  auditArtifactPaths,
  auditSandboxPreferences,
  auditShippedApp,
  bakedDeveloperPath,
  collectArtifactPaths,
  writeBuildInfo,
} from "../scripts/desktop/verify-artifact";
import { neutralizeStagedRepoPaths } from "../scripts/desktop/stage-next";

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

  it("flags realistic unknown-builder paths without probing the disk", () => {
    expect(
      bakedDeveloperPath('built in "/Users/jdoe/Projects/vl/.next/server"'),
    ).toBe(true);
    expect(
      bakedDeveloperPath('prefix "/home/buildagent/work/vl/output" suffix'),
    ).toBe(true);
    expect(bakedDeveloperPath('see "/Users/example/docs" for details')).toBe(
      false,
    );
  });

  it("audits shipped app contents across paths, content, and binaries", () => {
    const dir = fixture({
      "server/server.js": "ok",
      ".env": "KEY=val",
      "app/main.js":
        "sandbox: true\ncontextIsolation: true\nnodeIntegration: false\n",
      "app/creds.js": 'const url = "postgresql://u:***@host/db";',
    });
    const failures = auditShippedApp(dir, path.join(dir, "app/main.js"));
    expect(failures.join("\n")).toMatch(/environment file/);
    expect(failures.join("\n")).toMatch(/embedded database credential/);
    expect(failures.join("\n")).not.toMatch(/renderer policy/);
  });

  it("reports a shipped main process that lost the sandbox policy", () => {
    const dir = fixture({ "app/main.js": "sandbox: false\n" });
    const failures = auditShippedApp(dir, path.join(dir, "app/main.js"));
    expect(failures.join("\n")).toMatch(/renderer policy/);
  });

  it("neutralizes staged build-machine roots in Next output", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-neutral-"));
    const nextDir = path.join(dir, ".next/server");
    fs.mkdirSync(nextDir, { recursive: true });
    fs.writeFileSync(
      path.join(nextDir, "chunk.js"),
      'sources:["/repo-root/src/app/layout"]',
    );
    fs.writeFileSync(
      path.join(nextDir, "next-font-manifest.json"),
      JSON.stringify({ app: [["/repo-root/src/app/layout"]] }),
    );
    fs.writeFileSync(
      path.join(nextDir, "required-server-files.json"),
      JSON.stringify({ files: ["/repo-root/keep"] }),
    );
    expect(neutralizeStagedRepoPaths(dir, "/repo-root")).toBe(2);
    expect(fs.readFileSync(path.join(nextDir, "chunk.js"), "utf8")).not.toContain(
      "/repo-root",
    );
    expect(
      JSON.parse(fs.readFileSync(path.join(nextDir, "next-font-manifest.json"), "utf8")),
    ).toEqual({ app: [["/verbalibera-build-root/src/app/layout"]] });
    expect(
      fs.readFileSync(path.join(nextDir, "required-server-files.json"), "utf8"),
    ).toContain("/repo-root");
  });

  it("ties the DMG checksum to the source revision", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-buildinfo-"));
    const written = writeBuildInfo(dir, {
      dmg: "VerbaLibera-mac-arm64.dmg",
      sha: "abc123  VerbaLibera-mac-arm64.dmg",
    });
    expect(written).toBe(path.join(dir, "BUILD-INFO.json"));
    const info = JSON.parse(fs.readFileSync(written, "utf8")) as Record<
      string,
      string
    >;
    expect(info.dmg).toBe("VerbaLibera-mac-arm64.dmg");
    expect(info.sha).toBe("abc123  VerbaLibera-mac-arm64.dmg");
    expect(info.revision).toMatch(/^[0-9a-f]{40}$|^unknown$/);
    expect(Number.isNaN(Date.parse(info.builtAt))).toBe(false);
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
