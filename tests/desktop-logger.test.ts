// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "../desktop/runtime/logger";
import { redactLogLine } from "../desktop/security/redact";

describe("desktop rotating logs", () => {
  it("redacts secrets before writing and rotates at the size bound", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-log-"));
    const log = createLogger(dir, { maxBytes: 200, retain: 3 });
    log.write(
      "setup",
      "connecting DATABASE_URL=postgresql://u:pw@h/db for install",
    );
    log.write("server", "listening on 127.0.0.1:43127");
    for (let i = 0; i < 50; i += 1) {
      log.write("server", `heartbeat ${i} ` + "x".repeat(40));
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("desktop.log"))
      .sort();
    expect(files.length).toBeLessThanOrEqual(4);
    const all = files
      .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    expect(all).not.toMatch(/u:pw@/);
    expect(all).toMatch(/\[server\]/);
    // Every written line is tagged with its stage.
    for (const file of files) {
      for (const line of fs
        .readFileSync(path.join(dir, file), "utf8")
        .split("\n")
        .filter(Boolean)) {
        expect(line).toMatch(/^\[setup\]|\[database\]|\[migration\]|\[server\]|\[renderer\]|\[shutdown\]/);
      }
    }
    expect(redactLogLine("setup done")).toBe("setup done");
  });
});
