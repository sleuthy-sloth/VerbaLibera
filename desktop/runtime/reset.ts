// Storage-mode switching and recoverable local reset (Task 8).
// Mode changes are validated exactly like first-launch setup, persisted
// under `pending`, and promoted to `active` only during the next
// main-process startup. Local and remote data are never merged or copied.
// Reset requires the typed phrase, stops the owned database, renames the
// complete data directory into backups/, and never recursively deletes.
import fs from "node:fs";
import path from "node:path";
import {
  loadSettings,
  saveSettings,
  type DesktopSettings,
  type EncryptionAdapter,
} from "../settings/store";
import { validateRemoteDatabaseUrl } from "../settings/schema";

export const RESET_PHRASE = "RESET LOCAL DATA";

export type StorageChangeRequest =
  | { mode: "local" }
  | { mode: "remote"; databaseUrl: string };

export interface ScheduleDeps {
  userDataDir: string;
  schemaVersion: string;
  runningDatabaseUrl: string;
  crypto: EncryptionAdapter;
  testConnection: (url: string) => Promise<void>;
}

function currentSettings(
  userDataDir: string,
  schemaVersion: string,
): DesktopSettings {
  try {
    return loadSettings(userDataDir);
  } catch {
    return { version: 1, active: { mode: "local", schemaVersion } };
  }
}

export async function scheduleStorageChange(
  request: StorageChangeRequest,
  deps: ScheduleDeps,
): Promise<{ restartRequired: true }> {
  if (!deps.crypto.isEncryptionAvailable()) {
    throw new Error("macOS keychain encryption is unavailable.");
  }
  const settings = currentSettings(deps.userDataDir, deps.schemaVersion);
  if (request.mode === "remote") {
    validateRemoteDatabaseUrl(request.databaseUrl);
    await deps.testConnection(request.databaseUrl);
    settings.pending = {
      mode: "remote",
      encryptedDatabaseUrl: deps.crypto.encryptString(request.databaseUrl),
      schemaVersion: deps.schemaVersion,
    };
  } else {
    settings.pending = { mode: "local", schemaVersion: deps.schemaVersion };
  }
  saveSettings(deps.userDataDir, settings);
  return { restartRequired: true };
}

export interface ResetDeps {
  dataDir: string;
  stopDatabase: () => Promise<void>;
  clock?: () => Date;
}

export async function resetLocalData(
  phrase: string,
  deps: ResetDeps,
): Promise<{ backupPath: string }> {
  if (phrase !== RESET_PHRASE) {
    throw new Error(`Type ${RESET_PHRASE} to confirm destructive reset.`);
  }
  await deps.stopDatabase();
  const clock = deps.clock ?? (() => new Date());
  const stamp = clock().toISOString().replace(/[:.]/g, "-");
  const parent = path.dirname(deps.dataDir);
  const backupPath = path.join(parent, "backups", `local-data-${stamp}`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.renameSync(deps.dataDir, backupPath);
  fs.mkdirSync(deps.dataDir, { recursive: true, mode: 0o700 });
  return { backupPath };
}
