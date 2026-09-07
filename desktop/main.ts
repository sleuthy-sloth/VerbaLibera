// Electron main process (Tasks 5+6).
// Composition root: single instance, first-launch setup, local/remote
// database supervision, fixed-origin server, sandboxed windows with strict
// navigation guards, and deterministic shutdown.
import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from "electron";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP_ORIGIN } from "./security/urls";
import {
  startApplicationServer,
  healthUrl,
  type RunningServer,
} from "./runtime/server";
import {
  startLocalPostgres,
  stopOwnedProcess,
  type StopRuntime,
} from "./runtime/postgres";
import type { OwnedProcess, SpawnFn } from "./runtime/contracts";
import { desktopFailure, type DesktopFailureCode } from "./runtime/errors";
import { createLogger } from "./runtime/logger";
import { loadSettings, saveSettings } from "./settings/store";
import type { EncryptionAdapter } from "./settings/store";
import {
  runLocalSetup,
  inspectRemoteSetup,
  approveRemoteSetup,
  type ApprovalToken,
} from "./setup/flows";
import { ensureJwtKeys } from "./setup/keys";
import { createPrismaRunner, type PrismaRunnerPaths } from "./setup/prisma-runner";
import { migrateDatabase } from "./runtime/migrations";
import { validateRemoteDatabaseUrl } from "./settings/schema";
import { createIpcHandlers } from "./ipc";

const SCHEMA_VERSION_FALLBACK = "20260906000002";

let mainWindow: BrowserWindow | null = null;
let setupWindow: BrowserWindow | null = null;
let recoveryWindow: BrowserWindow | null = null;
let runningServer: RunningServer | null = null;
let ownedPostgres: OwnedProcess | null = null;
let stopRuntime: StopRuntime | null = null;
let logPath = "";
let userDataDir = "";

const approvalTokens = new Map<string, ApprovalToken>();

function logger() {
  return createLogger(path.join(userDataDir, "logs"));
}

function packagedSchemaVersion(migrationsDir: string): string {
  try {
    const names = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    return names.at(-1) ?? SCHEMA_VERSION_FALLBACK;
  } catch {
    return SCHEMA_VERSION_FALLBACK;
  }
}

interface ResourceLayout {
  repoRoot: string;
  serverEntry: string;
  postgresBinDir: string;
  psqlBin: string;
  migrationsDir: string;
  prisma: PrismaRunnerPaths;
  preloadEntry: string;
  setupHtml: string;
  recoveryHtml: string;
}

function resolveResources(): ResourceLayout {
  if (app.isPackaged) {
    const resources = process.resourcesPath;
    const nodeBin = process.execPath;
    return {
      repoRoot: resources,
      serverEntry: path.join(resources, "server/server.js"),
      postgresBinDir: path.join(resources, "postgres/bin"),
      psqlBin: path.join(resources, "postgres/bin/psql"),
      migrationsDir: path.join(resources, "server/prisma/migrations"),
      prisma: {
        migrate: {
          bin: nodeBin,
          args: [path.join(resources, "prisma-cli/index.js"), "migrate"],
        },
        seed: { bin: nodeBin, args: [path.join(resources, "seed/seed.cjs")] },
        psqlBin: path.join(resources, "postgres/bin/psql"),
      },
      preloadEntry: path.join(__dirname, "preload.js"),
      setupHtml: path.join(__dirname, "ui/setup.html"),
      recoveryHtml: path.join(__dirname, "ui/recovery.html"),
    };
  }
  const repoRoot = path.dirname(__dirname);
  return {
    repoRoot,
    serverEntry: path.join(repoRoot, ".desktop-stage/server/server.js"),
    postgresBinDir: path.join(repoRoot, ".desktop-stage/postgres/bin"),
    psqlBin: path.join(repoRoot, ".desktop-stage/postgres/bin/psql"),
    migrationsDir: path.join(repoRoot, "prisma/migrations"),
    prisma: {
      migrate: {
        bin: process.execPath,
        args: [path.join(repoRoot, "node_modules/prisma/build/index.js"), "migrate"],
      },
      seed: {
        bin: process.execPath,
        args: [
          path.join(repoRoot, "node_modules/tsx/dist/cli.mjs"),
          path.join(repoRoot, "prisma/seed.ts"),
        ],
      },
      psqlBin: path.join(repoRoot, ".desktop-stage/postgres/bin/psql"),
    },
    preloadEntry: path.join(repoRoot, "desktop-dist/preload.js"),
    setupHtml: path.join(repoRoot, "desktop-dist/ui/setup.html"),
    recoveryHtml: path.join(repoRoot, "desktop-dist/ui/recovery.html"),
  };
}

const safeStorageAdapter: EncryptionAdapter = {
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
  encryptString: (plain: string) =>
    safeStorage.encryptString(plain).toString("base64"),
  decryptString: (cipher: string) =>
    safeStorage.decryptString(Buffer.from(cipher, "base64")),
};

function localSecretPath(): string {
  return path.join(userDataDir, "local-db.json");
}

function saveLocalSecret(password: string): void {
  const envelope = JSON.stringify({
    encryptedPassword: safeStorageAdapter.encryptString(password),
  });
  fs.writeFileSync(localSecretPath(), envelope, { mode: 0o600 });
  fs.chmodSync(localSecretPath(), 0o600);
}

function readLocalSecret(): string {
  const raw = fs.readFileSync(localSecretPath(), "utf8");
  const parsed = JSON.parse(raw) as { encryptedPassword?: unknown };
  if (typeof parsed.encryptedPassword !== "string") {
    throw new Error("Local database secret is corrupt.");
  }
  return safeStorageAdapter.decryptString(parsed.encryptedPassword);
}

const awaitSpawn: SpawnFn = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(cmd, args);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve({ pid: child.pid ?? 0, exitCode: 0 });
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });

async function allocPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not allocate a loopback port."));
      });
    });
  });
}

function psqlProbe(psqlBin: string) {
  return (databaseUrl: string): Promise<boolean> =>
    new Promise((resolve) => {
      execFile(
        psqlBin,
        [databaseUrl, "-tAc", "SELECT 1"],
        { timeout: 5000 },
        (error, stdout) => {
          resolve(!error && String(stdout).trim() === "1");
        },
      );
    });
}

const sleep = (ms: number) =>
  new Promise<void>((done) => {
    setTimeout(done, ms);
  });

function secureWindow(file: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 720,
    height: 640,
    webPreferences: {
      preload: resolveResources().preloadEntry,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== pathToFileURL(file).href) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.session.setPermissionRequestHandler((_wc, _perm, callback) => {
    callback(false);
  });
  void window.loadFile(file);
  return window;
}

export function createMainWindow(initialPath = "/dashboard"): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  void mainWindow.loadURL(`${APP_ORIGIN}${initialPath}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

function showRecovery(code: DesktopFailureCode, message: string): void {
  const res = resolveResources();
  if (setupWindow) {
    setupWindow.close();
    setupWindow = null;
  }
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
  logger().write("renderer", `recovery ${code}: ${message}`);
  recoveryWindow = secureWindow(res.recoveryHtml);
  const hash = `#code=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}`;
  void recoveryWindow.loadFile(res.recoveryHtml, { hash });
}

function registerIpc(res: ResourceLayout): void {
  const allowedSenderUrls = [
    pathToFileURL(res.setupHtml).href,
    pathToFileURL(res.recoveryHtml).href,
  ];
  const handlers = createIpcHandlers({
    allowedSenderUrls,
    flows: {
      chooseLocal: async () => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw desktopFailure(
            "ENCRYPTION_UNAVAILABLE",
            "macOS keychain encryption is unavailable; local setup cannot continue.",
          );
        }
        const password = randomBytes(32).toString("base64url");
        const schemaVersion = packagedSchemaVersion(res.migrationsDir);
        const runner = createPrismaRunner(res.prisma);
        await runLocalSetup({
          userDataDir,
          schemaVersion,
          initDatabase: async () => {
            const owned = await startLocalPostgres({
              runtimeBinDir: res.postgresBinDir,
              dataRoot: path.join(userDataDir, "db"),
              password,
              spawn: awaitSpawn,
              randomBytes: (n: number) => randomBytes(n),
              allocPort,
              probe: psqlProbe(res.psqlBin),
              sleep,
            });
            ownedPostgres = owned;
            stopRuntime = { spawn: awaitSpawn, runtimeBinDir: res.postgresBinDir };
            saveLocalSecret(password);
            return { databaseUrl: owned.databaseUrl, dataDir: owned.dataDir };
          },
          migrate: async ({ databaseUrl, dataDir }) => {
            await migrateDatabase({
              mode: "local",
              databaseUrl,
              dataDir,
              appVersion: app.getVersion(),
              packagedSchemaVersion: schemaVersion,
              runner,
            });
          },
          startServer: async ({ databaseUrl }) => {
            const { bootstrapSecret } = await bootServer(res, databaseUrl, "local");
            await openMainWindow("/desktop/profiles", bootstrapSecret);
          },
        });
        setupWindow?.close();
        setupWindow = null;
        return { ok: true as const };
      },
      inspectRemote: async (url: string) => {
        const runner = createPrismaRunner(res.prisma);
        await psqlProbe(res.psqlBin)(url).then((ok) => {
          if (!ok) {
            throw desktopFailure("REMOTE_UNREACHABLE", "Could not connect to the remote database.");
          }
        });
        return inspectRemoteSetup(url, {
          tokens: approvalTokens,
          now: () => Date.now(),
          testConnection: async () => {},
          listPending: async (candidate: string) => {
            const applied = await runner.listApplied(candidate);
            const { pendingMigrations } = await import("./runtime/migrations");
            const fs = await import("node:fs");
            const available = fs
              .readdirSync(res.migrationsDir, { withFileTypes: true })
              .filter((e) => e.isDirectory())
              .map((e) => e.name)
              .sort();
            return pendingMigrations(available, applied);
          },
        });
      },
      approveRemoteMigration: async (token: string) => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw desktopFailure(
            "ENCRYPTION_UNAVAILABLE",
            "macOS keychain encryption is unavailable; remote setup cannot continue.",
          );
        }
        const runner = createPrismaRunner(res.prisma);
        const schemaVersion = packagedSchemaVersion(res.migrationsDir);
        await approveRemoteSetup(token, {
          tokens: approvalTokens,
          now: () => Date.now(),
          finish: async (url: string) => {
            validateRemoteDatabaseUrl(url);
            await migrateDatabase({
              mode: "remote",
              databaseUrl: url,
              dataDir: path.join(userDataDir, "db"),
              appVersion: app.getVersion(),
              packagedSchemaVersion: schemaVersion,
              approved: true,
              runner,
            });
            saveSettings(userDataDir, {
              version: 1,
              active: {
                mode: "remote",
                encryptedDatabaseUrl:
                  safeStorageAdapter.encryptString(url),
                schemaVersion,
              },
            });
            await bootServer(res, url, "remote");
            return { ok: true as const };
          },
        });
        setupWindow?.close();
        setupWindow = null;
        createMainWindow();
        return { ok: true as const };
      },
      revealLog: async () => {
        shell.showItemInFolder(logPath || path.join(userDataDir, "logs"));
      },
      restart: async () => {
        app.relaunch();
        app.exit(0);
      },
    },
  });
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args: unknown[]) =>
      handler({ senderFrame: event.senderFrame }, ...args),
    );
  }
}

async function bootServer(
  res: ResourceLayout,
  databaseUrl: string,
  mode: "local" | "remote",
): Promise<{ bootstrapSecret: string }> {
  const keys = ensureJwtKeys(path.join(userDataDir, "keys"));
  const bootstrapSecret = randomBytes(32).toString("base64url");
  runningServer = await startApplicationServer({
    serverEntry: res.serverEntry,
    databaseUrl,
    desktopMode: mode,
    bootstrapSecret,
    healthIdentity: randomBytes(16).toString("hex"),
    appVersion: app.getVersion(),
    jwtPrivateKeyPath: keys.privatePath,
    jwtPublicKeyPath: keys.publicPath,
    launch: (entry, env) =>
      new Promise((resolve, reject) => {
        const child: ChildProcess = spawn(process.execPath, [entry], { env });
        if (child.pid === undefined) {
          reject(new Error("Failed to spawn application server."));
          return;
        }
        const pid = child.pid;
        resolve({
          pid,
          kill: () => child.kill("SIGTERM"),
          exited: new Promise<number>((done) => {
            child.on("exit", (code) => done(code ?? 0));
          }),
        });
      }),
    fetchHealth: async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = (await response.json()) as {
          identity?: unknown;
          version?: unknown;
        };
        if (typeof data.identity !== "string" || typeof data.version !== "string") {
          return null;
        }
        return { identity: data.identity, version: data.version };
      } catch {
        return null;
      }
    },
    sleep,
  });
  return { bootstrapSecret };
}

/** Sets the per-launch HTTP-only bootstrap cookie before the main window loads. */
async function seedBootstrapCookie(bootstrapSecret: string): Promise<void> {
  await session.defaultSession.cookies.set({
    url: APP_ORIGIN,
    name: "verbalibera_bootstrap",
    value: bootstrapSecret,
    httpOnly: true,
  });
}

async function openMainWindow(initialPath: string, bootstrapSecret: string): Promise<void> {
  await seedBootstrapCookie(bootstrapSecret);
  createMainWindow(initialPath);
}

async function startup(): Promise<void> {
  userDataDir = app.getPath("userData");
  logPath = path.join(userDataDir, "logs", "desktop.log");
  const res = resolveResources();
  registerIpc(res);
  let settings: ReturnType<typeof loadSettings> | null = null;
  try {
    settings = loadSettings(userDataDir);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("not found")
    ) {
      setupWindow = secureWindow(res.setupHtml);
      return;
    }
    showRecovery("SETTINGS_CORRUPT", error instanceof Error ? error.message : String(error));
    return;
  }
  try {
    if (settings.active.mode === "local") {
      const schemaVersion = packagedSchemaVersion(res.migrationsDir);
      const password = readLocalSecret();
      const runner = createPrismaRunner(res.prisma);
      const owned = await startLocalPostgres({
        runtimeBinDir: res.postgresBinDir,
        dataRoot: path.join(userDataDir, "db"),
        password,
        spawn: awaitSpawn,
        randomBytes: (n: number) => randomBytes(n),
        allocPort,
        probe: psqlProbe(res.psqlBin),
        sleep,
      });
      ownedPostgres = owned;
      stopRuntime = { spawn: awaitSpawn, runtimeBinDir: res.postgresBinDir };
      await migrateDatabase({
        mode: "local",
        databaseUrl: owned.databaseUrl,
        dataDir: owned.dataDir,
        appVersion: app.getVersion(),
        packagedSchemaVersion: schemaVersion,
        runner,
      });
      const { bootstrapSecret } = await bootServer(res, owned.databaseUrl, "local");
      await openMainWindow("/desktop/profiles", bootstrapSecret);
    } else {
      const url = safeStorageAdapter.decryptString(
        settings.active.encryptedDatabaseUrl,
      );
      const runner = createPrismaRunner(res.prisma);
      const applied = await runner.listApplied(url);
      const { pendingMigrations } = await import("./runtime/migrations");
      const fs = await import("node:fs");
      const available = fs
        .readdirSync(res.migrationsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      if (pendingMigrations(available, applied).length > 0) {
        setupWindow = secureWindow(res.setupHtml);
        return;
      }
      await bootServer(res, url, "remote");
      createMainWindow();
    }
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? String((error as { code: unknown }).code)
        : "UNKNOWN";
    showRecovery(
      code as DesktopFailureCode,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function shutdown(): Promise<void> {
  try {
    logger().write("shutdown", "stopping desktop services");
  } catch {
    // logging must never block shutdown
  }
  for (const window of [mainWindow, setupWindow, recoveryWindow]) {
    try {
      window?.close();
    } catch {
      // ignore
    }
  }
  mainWindow = setupWindow = recoveryWindow = null;
  if (runningServer) {
    const server = runningServer;
    runningServer = null;
    server.kill();
    const force = setTimeout(() => {
      try {
        process.kill(server.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }, 5000);
    await Promise.race([server.exited, sleep(5100)]);
    clearTimeout(force);
  }
  if (ownedPostgres && stopRuntime) {
    const owned = ownedPostgres;
    const runtime = stopRuntime;
    ownedPostgres = null;
    stopRuntime = null;
    await stopOwnedProcess(owned, runtime).catch(() => owned.kill());
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = mainWindow ?? setupWindow ?? recoveryWindow;
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  void app.whenReady().then(() => {
    void startup().catch((error: unknown) => {
      showRecovery(
        "UNKNOWN" as DesktopFailureCode,
        error instanceof Error ? error.message : String(error),
      );
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      void shutdown().then(() => app.quit());
    }
  });
  app.on("before-quit", (event) => {
    event.preventDefault();
    void shutdown().then(() => app.exit(0));
  });
}

export { healthUrl };
