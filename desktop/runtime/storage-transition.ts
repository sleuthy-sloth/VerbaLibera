// Pending storage-mode activation for the desktop app (Milestone B3).
// A scheduled mode change lives under `pending` until the new mode has
// actually booted. Activation is persisted only after success; a failed
// activation keeps the previous working configuration (and its data)
// intact instead of stranding the install in recovery.
//
// Remote-first → local works because the local database secret is created
// on first transition: a remote-first install never had one, and without
// it the local branch used to enter recovery. Local data is never copied
// or merged — switching only flips which store boots.
import type { DesktopSettings } from "../settings/store";
import type { StorageChoice } from "../settings/schema";

export interface SecretDeps {
  /** True when no local database secret envelope exists yet. */
  secretMissing: () => boolean;
  generatePassword: () => string;
  savePassword: (password: string) => void;
  log: (message: string) => void;
}

/**
 * Creates the local database secret on first transition to local storage.
 * No-op when a secret already exists; never touches an existing cluster,
 * so returning local progress is preserved byte-for-byte.
 */
export function ensureLocalSecret(deps: SecretDeps): void {
  if (!deps.secretMissing()) return;
  const password = deps.generatePassword();
  deps.savePassword(password);
  deps.log("created first-time local database secret for pending local mode");
}

/**
 * Returns the settings to persist after the pending mode booted
 * successfully. Local activations are stamped with the running packaged
 * schema version; remote activations keep the approved scheduled choice.
 * Without a pending change the settings pass through untouched.
 */
export function activatedSettings(
  settings: DesktopSettings,
  schemaVersion: string,
): DesktopSettings {
  if (!settings.pending) return settings;
  const active: StorageChoice =
    settings.pending.mode === "local"
      ? { mode: "local", schemaVersion }
      : settings.pending;
  return { version: 1, active };
}
