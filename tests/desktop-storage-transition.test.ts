// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  ensureLocalSecret,
  activatedSettings,
} from "../desktop/runtime/storage-transition";
import type { DesktopSettings } from "../desktop/settings/store";

function secretDeps(secretMissing: boolean) {
  return {
    secretMissing: () => secretMissing,
    generatePassword: vi.fn(() => "generated-password"),
    savePassword: vi.fn(),
    log: vi.fn(),
  };
}

describe("pending storage activation", () => {
  it("creates the local secret on first transition to local", () => {
    const deps = secretDeps(true);
    ensureLocalSecret(deps);
    expect(deps.generatePassword).toHaveBeenCalledOnce();
    expect(deps.savePassword).toHaveBeenCalledWith("generated-password");
  });

  it("leaves an existing secret and its cluster alone", () => {
    const deps = secretDeps(false);
    ensureLocalSecret(deps);
    expect(deps.generatePassword).not.toHaveBeenCalled();
    expect(deps.savePassword).not.toHaveBeenCalled();
  });

  it("activates a booted local mode with the running schema version", () => {
    const settings: DesktopSettings = {
      version: 1,
      active: {
        mode: "remote",
        encryptedDatabaseUrl: "enc:url",
        schemaVersion: "20260906000002",
      },
      pending: { mode: "local", schemaVersion: "20260906000002" },
    };
    expect(activatedSettings(settings, "20260907000000")).toEqual({
      version: 1,
      active: { mode: "local", schemaVersion: "20260907000000" },
    });
  });

  it("activates a booted remote mode with its approved scheduled choice", () => {
    const pending = {
      mode: "remote" as const,
      encryptedDatabaseUrl: "enc:url",
      schemaVersion: "20260906000002",
    };
    const settings: DesktopSettings = {
      version: 1,
      active: { mode: "local", schemaVersion: "20260906000002" },
      pending,
    };
    expect(activatedSettings(settings, "20260907000000")).toEqual({
      version: 1,
      active: pending,
    });
  });

  it("passes settings through when nothing is pending", () => {
    const settings: DesktopSettings = {
      version: 1,
      active: { mode: "local", schemaVersion: "20260906000002" },
    };
    expect(activatedSettings(settings, "20260907000000")).toBe(settings);
  });
});
