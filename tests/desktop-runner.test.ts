// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { runChild } from "../desktop/setup/prisma-runner";

describe("desktop packaged child processes", () => {
  it("runs helpers as plain Node with a closed stdin", async () => {
    const { stdout } = await runChild(
      process.execPath,
      ["-e", "console.log(process.env.ELECTRON_RUN_AS_NODE ?? 'unset')"],
      "postgresql://u:p@127.0.0.1:1/db",
    );
    expect(stdout.trim()).toBe("1");
  });

  it("reports the failing command with trailing output", async () => {
    await expect(
      runChild(
        process.execPath,
        ["-e", "console.error('boom-detail'); process.exit(3)"],
        "postgresql://u:***@127.0.0.1:1/db",
      ),
    ).rejects.toThrow(/boom-detail/);
  });

  it("runs helpers in the given working directory", async () => {
    const { stdout } = await runChild(
      process.execPath,
      ["-e", "console.log(process.cwd())"],
      "postgresql://u:***@127.0.0.1:1/db",
      {},
      "/tmp",
    );
    // macOS resolves /tmp to /private/tmp.
    expect(stdout.trim()).toBe(fs.realpathSync("/tmp"));
  });
});
