// @vitest-environment node
import { describe, it, expect } from "vitest";
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
        "postgresql://u:p@127.0.0.1:1/db",
      ),
    ).rejects.toThrow(/boom-detail/);
  });
});
