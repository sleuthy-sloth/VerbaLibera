import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";

const config: ForgeConfig = {
  packagerConfig: {
    // Bundle the compiled main process via package.json "main".
    executableName: "VerbaLibera",
    // Unpacked at runtime: native PostgreSQL binaries and the staged server.
    asar: { unpack: "**/resources/{postgres,server}/**" },
    icon: "./public/icons/icon",
    ignore: [
      /^\/\.git\//,
      /^\/\.next\/cache/,
      /^\/\.desktop-stage/,
      /^\/dist\//,
      /^\/tests\//,
      /^\/services\//,
      /^\/docs\//,
      /^\/courses\//,
      /^\/src\//,
      /^\/scripts\//,
      /^\/desktop\//,
      /^\/\.vercel/,
      /^\/\.worktrees/,
      /^\/test-results/,
      /^\/playwright-report/,
      /\.map$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      // Unsigned first release; signing/notarization fields arrive later
      // through release secrets without application-code changes.
    }),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};

export default config;
