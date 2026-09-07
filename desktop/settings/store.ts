import fs from "node:fs";
import path from "node:path";
import { desktopSettingsSchema, type DesktopSettings } from "./schema";

export type { DesktopSettings };

export interface EncryptionAdapter {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): string;
  decryptString(cipher: string): string;
}

const FILE_NAME = "settings.json";

function settingsFile(dir: string): string {
  return path.join(dir, FILE_NAME);
}

/** Atomically writes settings (tmp + chmod 0600 + rename). */
export function saveSettings(dir: string, settings: DesktopSettings): string {
  const parsed = desktopSettingsSchema.parse(settings);
  const file = settingsFile(dir);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(parsed, null, 2), {
    mode: 0o600,
    encoding: "utf8",
  });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
  fs.chmodSync(file, 0o600);
  return file;
}

/** Loads and strictly validates settings; throws on corrupt/unknown content. */
export function loadSettings(
  dir: string,
  _crypto?: EncryptionAdapter,
): DesktopSettings {
  const file = settingsFile(dir);
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(`Desktop settings not found at ${file}.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Desktop settings are corrupt (invalid JSON).");
  }
  const parsed = desktopSettingsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Desktop settings are invalid: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
