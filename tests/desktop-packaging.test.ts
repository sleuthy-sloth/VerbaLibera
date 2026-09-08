// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const MAIN_JS_PATH = path.join(ROOT, "desktop-dist/main.js");
const STAGED_MODULES = path.join(ROOT, ".desktop-stage/prisma-cli/node_modules");
const STAGED_CLI_ENTRY = path.join(STAGED_MODULES, "prisma/build/index.js");
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

  it("keeps build-only runners out of production dependencies", () => {
    // Regression: `tsx` lived in dependencies and shipped its universal
    // fsevents binary inside the app, failing the arm64-only artifact audit.
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    expect(pkg.dependencies ?? {}).not.toHaveProperty("tsx");
    expect(pkg.devDependencies ?? {}).toHaveProperty("tsx");
  });

  it.skipIf(!fs.existsSync(STAGED_CLI_ENTRY))(
    "staged prisma config resolves `prisma/config` without repo node_modules",
    () => {
      // Regression: packaged first runs crashed with
      // `Cannot find module 'prisma/config'` because Node resolves the
      // specifier from the staged config file, which ships with no
      // node_modules of its own. In-repo runs masked it via upward
      // resolution into the repo's node_modules, so this test replays an
      // install-isolated jail under tmpdir (whose ancestors carry no
      // prisma) with only the staged server tree + CLI symlinked in.
      const jail = fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-prisma-jail-"));
      // Mirror the shipped layout exactly: <stage>/server + <stage>/prisma-cli
      // as siblings (the shim's relative require depends on that depth).
      const stageDir = path.join(jail, "stage");
      const serverDir = path.join(ROOT, ".desktop-stage/server");
      const jailServer = path.join(stageDir, "server");
      // Only what config resolution touches (never the whole .next tree).
      for (const rel of ["prisma.config.ts", "prisma", "node_modules"]) {
        fs.cpSync(path.join(serverDir, rel), path.join(jailServer, rel), {
          recursive: true,
        });
      }
      fs.symlinkSync(
        path.join(ROOT, ".desktop-stage/prisma-cli"),
        path.join(stageDir, "prisma-cli"),
      );
      const requireFromJail = createRequire(
        path.join(stageDir, "server", "prisma.config.ts"),
      );
      // Must resolve at all: without the staged shim this throws
      // MODULE_NOT_FOUND (the jail's ancestors carry no prisma). The target
      // realpaths out of the jail only because the test symlinks the CLI;
      // the shipped app carries real directories.
      const resolved = requireFromJail.resolve("prisma/config");
      expect(resolved.endsWith("prisma/config.js")).toBe(true);
      const configModule = requireFromJail("prisma/config") as {
        defineConfig?: unknown;
      };
      expect(typeof configModule.defineConfig).toBe("function");
    },
  );

  it.skipIf(!fs.existsSync(STAGED_CLI_ENTRY))(
    "staged Prisma CLI resolves its dependency closure",
    () => {
      // Regression: the staged CLI crashed with MODULE_NOT_FOUND (`effect`,
      // required by `@prisma/config`) on first packaged launch. Pin
      // resolvability of the known third-party dep from the staged tree.
      // (A blind loop over all manifest deps over-asserts: ESM-only packages
      // like `@prisma/studio-core` are never loaded by `migrate deploy`.)
      const requireFromConfig = createRequire(
        path.join(STAGED_MODULES, "@prisma/config/package.json"),
      );
      expect(() => requireFromConfig.resolve("effect")).not.toThrow();
    },
  );

  it.skipIf(!fs.existsSync(STAGED_CLI_ENTRY))(
    "staged server carries its Prisma config and schema",
    () => {
      // migrate deploy resolves prisma.config.ts and prisma/ relative to its
      // working directory; without these staged files packaged launches fail
      // from any directory without the repo checked out (e.g. Finder).
      const serverDir = path.join(ROOT, ".desktop-stage/server");
      expect(fs.existsSync(path.join(serverDir, "prisma.config.ts"))).toBe(true);
      expect(fs.existsSync(path.join(serverDir, "prisma/schema.prisma"))).toBe(
        true,
      );
      expect(
        fs.existsSync(path.join(serverDir, "prisma/migrations")),
      ).toBe(true);
      // The staged config must not require dev-only packages: DATABASE_URL
      // always arrives via the child environment and no .env is staged.
      const stagedConfig = fs.readFileSync(
        path.join(serverDir, "prisma.config.ts"),
        "utf8",
      );
      expect(stagedConfig).not.toContain("dotenv/config");
    },
  );

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
