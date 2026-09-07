// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAIN_JS_PATH = path.join(ROOT, "desktop-dist/main.js");
// desktop-dist/ is gitignored build output produced by `npm run desktop:compile`.
// Clean Linux CI runners lack it, so the compiled-main assertion below only runs
// when the artifact is present instead of failing with ENOENT.

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

  it("ships staged server, database, and license resources unpacked", async () => {
    const forgeConfig = (await import("../forge.config")).default as {
      packagerConfig?: {
        extraResource?: string[];
        asar?: boolean | { unpack?: string };
      };
    };
    const extra = JSON.stringify(forgeConfig.packagerConfig?.extraResource ?? []);
    expect(extra).toMatch(/\.desktop-stage\/server/);
    expect(extra).toMatch(/\.desktop-stage\/postgres/);
    expect(extra).toMatch(/THIRD_PARTY_NOTICES/);
  });

  it("provides the electron artifact verification command", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.["electron:verify"]).toMatch(/verify-artifact/);
    expect(packageJson.scripts?.["electron:make"]).toMatch(/--arch=arm64/);
  });

  it.skipIf(!fs.existsSync(MAIN_JS_PATH))(
    "ships no auto-updater package, feed, or update channel",
    async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = JSON.stringify({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });
    expect(allDeps).not.toMatch(/electron-updater|update-electron-app/);
    const mainJs = fs.readFileSync(
      path.join(process.cwd(), "desktop-dist/main.js"),
      "utf8",
    );
    expect(mainJs).not.toMatch(/autoUpdater|checkForUpdates|feedURL/);
    },
  );
});
