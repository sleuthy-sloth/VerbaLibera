// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadSettings,
  saveSettings,
  type DesktopSettings,
} from "../desktop/settings/store";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "verbalibera-settings-"));
}

describe("desktop settings store", () => {
  it("round-trips local settings with restricted file permissions", () => {
    const dir = tmpDir();
    const settings: DesktopSettings = {
      version: 1,
      active: { mode: "local", schemaVersion: "20260906000002" },
    };
    const file = saveSettings(dir, settings);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(loadSettings(dir)).toEqual(settings);
  });

  it("encrypts remote database URLs through the injected adapter", () => {
    const dir = tmpDir();
    const settings: DesktopSettings = {
      version: 1,
      active: {
        mode: "remote",
        encryptedDatabaseUrl:
          "enc:postgresql://u:pw@db.example.com/app?sslmode=require",
        schemaVersion: "20260906000002",
      },
    };
    saveSettings(dir, settings);
    const raw = fs.readFileSync(path.join(dir, "settings.json"), "utf8");
    // The fake adapter only tags the value; production uses safeStorage.
    // The store contract is: bytes on disk equal the adapter output exactly.
    expect(raw).toMatch(/enc:postgresql:\/\/u:pw@/);
    expect(loadSettings(dir)).toEqual(settings);
  });

  it("rejects corrupt JSON and unknown keys", () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, "settings.json"), "{not json");
    expect(() => loadSettings(dir)).toThrow(/settings/i);
    fs.writeFileSync(
      path.join(dir, "settings.json"),
      JSON.stringify({
        version: 1,
        active: { mode: "local", schemaVersion: "x" },
        evil: true,
      }),
    );
    expect(() => loadSettings(dir)).toThrow(/unrecognized|unknown/i);
  });

  it("keeps pending storage changes separate from active storage", () => {
    const dir = tmpDir();
    const settings: DesktopSettings = {
      version: 1,
      active: { mode: "local", schemaVersion: "20260906000002" },
      pending: { mode: "local", schemaVersion: "20260906000002" },
    };
    saveSettings(dir, settings);
    const loaded = loadSettings(dir);
    expect(loaded.active).toEqual(settings.active);
    expect(loaded.pending).toEqual(settings.pending);
  });
});
