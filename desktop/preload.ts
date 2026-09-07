// Preload wiring (Task 6). The API surface itself is defined and tested
// in preload-api.ts; this module only bridges it to Electron IPC.
import { contextBridge, ipcRenderer } from "electron";
import { createExposedApi } from "./preload-api";

contextBridge.exposeInMainWorld(
  "verbalibera",
  createExposedApi((channel, ...args) => ipcRenderer.invoke(channel, ...args)),
);
