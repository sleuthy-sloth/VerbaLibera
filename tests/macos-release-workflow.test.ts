import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github/workflows/macos-release.yml",
);

function readWorkflow(): string {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new Error(`Workflow not found at ${WORKFLOW_PATH}`);
  }
  return fs.readFileSync(WORKFLOW_PATH, "utf8");
}

describe("macOS release workflow", () => {
  it("exists at .github/workflows/macos-release.yml", () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it("builds both self-contained editions on Apple Silicon", () => {
    const workflow = readWorkflow();
    expect(workflow).toMatch(/runs-on:\s*macos-15/);
    expect(workflow).toMatch(/npm ci/);
    expect(workflow).toMatch(/npm run postgres:prepare/);
    expect(workflow).toMatch(/npm run postgres:verify/);
    expect(workflow).toMatch(/npm run portable:build/);
    expect(workflow).toMatch(/npm run portable:verify/);
    expect(workflow).toMatch(/npm run electron:make/);
    expect(workflow).toMatch(/npm run electron:verify/);
    expect(workflow).toMatch(/VerbaLibera-Portable\.html/);
    expect(workflow).toMatch(/VerbaLibera-mac-arm64\.dmg/);
  });

  it("releases on tags without any signing configuration", () => {
    const workflow = readWorkflow();
    expect(workflow).toMatch(/v\*/);
    expect(workflow).toMatch(/workflow_dispatch/);
    expect(workflow).not.toMatch(/APPLE_ID|CSC_LINK|notar/i);
  });
});
