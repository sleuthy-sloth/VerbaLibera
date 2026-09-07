// Minimal preload skeleton (Task 1).
// The restricted setup/recovery API surface arrives in Task 6.
import { contextBridge } from "electron";

export const exposedApi = {} as const;

contextBridge.exposeInMainWorld("verbalibera", exposedApi);
