// The exact renderer API surface (Task 6).
// Only these five methods cross the isolated-preload boundary; every other
// main-process capability stays unreachable from web content.
export const EXPOSED_METHODS = [
  "chooseLocal",
  "inspectRemote",
  "approveRemoteMigration",
  "revealLog",
  "restart",
  "getStorageStatus",
  "scheduleStorageChange",
  "resetLocalData",
] as const;

export type ExposedMethod = (typeof EXPOSED_METHODS)[number];

export interface StorageStatus {
  active: { mode: "local" } | { mode: "remote" };
  pending: { mode: "local" } | { mode: "remote" } | null;
  restartRequired: boolean;
}

export interface RendererApi {
  chooseLocal: () => Promise<{ ok: true }>;
  inspectRemote: (
    url: string,
  ) => Promise<{ pending: string[]; approvalToken: string }>;
  approveRemoteMigration: (token: string) => Promise<{ ok: true }>;
  revealLog: () => Promise<void>;
  restart: () => Promise<void>;
  getStorageStatus: () => Promise<StorageStatus>;
  scheduleStorageChange: (request: {
    mode: "local" | "remote";
    databaseUrl?: string;
  }) => Promise<{ restartRequired: true }>;
  resetLocalData: (phrase: string) => Promise<{ backupPath: string }>;
}

export function createExposedApi(
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>,
): RendererApi {
  return {
    chooseLocal: () =>
      invoke("verbalibera:chooseLocal") as Promise<{ ok: true }>,
    inspectRemote: (url: string) =>
      invoke("verbalibera:inspectRemote", url) as Promise<{
        pending: string[];
        approvalToken: string;
      }>,
    approveRemoteMigration: (token: string) =>
      invoke("verbalibera:approveRemoteMigration", token) as Promise<{
        ok: true;
      }>,
    revealLog: () => invoke("verbalibera:revealLog") as Promise<void>,
    restart: () => invoke("verbalibera:restart") as Promise<void>,
    getStorageStatus: () =>
      invoke("verbalibera:getStorageStatus") as Promise<StorageStatus>,
    scheduleStorageChange: (request: { mode: "local" | "remote"; databaseUrl?: string }) =>
      invoke("verbalibera:scheduleStorageChange", request) as Promise<{
        restartRequired: true;
      }>,
    resetLocalData: (phrase: string) =>
      invoke("verbalibera:resetLocalData", phrase) as Promise<{
        backupPath: string;
      }>,
  };
}
