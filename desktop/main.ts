// Minimal Electron main-process skeleton (Task 1).
// Lifecycle, database supervision, and setup/recovery windows arrive in
// Tasks 4-6; this file only owns the single app instance and a sandboxed
// window pointed at the fixed local application origin.
import { app, BrowserWindow } from "electron";
import { APP_ORIGIN } from "./security/urls";

let mainWindow: BrowserWindow | null = null;

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
    if (process.platform !== "darwin") app.quit();
  });
}
