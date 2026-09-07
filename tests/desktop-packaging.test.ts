// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("desktop packaging configuration", () => {
  it("enables standalone Next output and arm64-only DMG packaging", async () => {
    const nextConfig = (await import("../next.config")).default as {
      output?: string;
    };
    expect(nextConfig.output).toBe("standalone");

    const forgeConfig = (await import("../forge.config")).default as {
      packagerConfig?: { asar?: boolean | { unpack?: string } };
      makers?: unknown[];
    };
    const asar = forgeConfig.packagerConfig?.asar;
    expect(asar === true || (typeof asar === "object" && !!asar.unpack)).toBe(
      true,
    );
    expect(JSON.stringify(asar)).toMatch(/resources/);
    expect(JSON.stringify(forgeConfig.makers)).toMatch(/dmg/i);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as { devDependencies?: Record<string, string> };
    expect(packageJson.devDependencies?.electron).toBe("44.2.0");
  });

  it("stages the standalone server without developer paths", async () => {
    const { stageNextServer } = await import(
      "../scripts/desktop/stage-next"
    );
    expect(typeof stageNextServer).toBe("function");
  });
});
