// Electron main process (Tasks 1+5).
// Composition root: single instance, sandboxed window, deterministic
// shutdown (close windows, terminate server, wait, force reap, stop owned
// PostgreSQL). First-launch setup windows arrive in Task 6.
import { app, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { APP_ORIGIN } from "./security/urls";
import { HEALTH_PATH, startApplicationServer, type LaunchedServer, type RunningServer } from "./runtime/server";
import { stopOwnedProcess } from "./runtime/postgres";
import type { OwnedProcess } from "./runtime/contracts";
import { createLogger } from "./runtime/logger";

let mainWindow: BrowserWindow | null = null;
let runningServer: RunningServer | null = null;
let ownedPostgres: OwnedProcess | null = null;
let postgresBinDir = "";

const log = createLogger(`${app.getPath("userData")}/logs`);

export function createMainWindow(): BrowserWindow {
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
  void mainWindow.loadURL(`${APP_ORIGIN}/dashboard`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

async function fetchHealth(url: string): Promise<{
  identity: string;
  version: string;
} | null> {
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
}

function launchNode(
  entry: string,
  env: Record<string, string>,
): Promise<LaunchedServer> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [entry], { env });
    if (child.pid === undefined) {
      reject(new Error("Failed to spawn application server."));
      return;
    }
    const pid = child.pid;
    const exited = new Promise<number>((done) => {
      child.on("exit", (code) => done(code ?? 0));
    });
    resolve({
      pid,
      kill: () => {
        child.kill("SIGTERM");
      },
      exited,
    });
  });
}

const sleep = (ms: number) =>
  new Promise<void>((done) => {
    setTimeout(done, ms);
  });

async function shutdown(): Promise<void> {
  log.write("shutdown", "stopping desktop services");
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
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
  if (ownedPostgres && postgresBinDir) {
    const owned = ownedPostgres;
    ownedPostgres = null;
    await stopOwnedProcess(owned, {
      spawn: async (cmd, args) => {
        const child: ChildProcess = spawn(cmd, args);
        await new Promise<void>((done) => child.on("exit", () => done()));
        return { pid: child.pid ?? 0 };
      },
      runtimeBinDir: postgresBinDir,
    }).catch((error: unknown) => {
      log.write("shutdown", `postgres stop failed: ${String(error)}`);
      owned.kill();
    });
  }
  log.write("shutdown", "desktop services stopped");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  void app.whenReady().then(() => {
    createMainWindow();
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

export { HEALTH_PATH, startApplicationServer };
