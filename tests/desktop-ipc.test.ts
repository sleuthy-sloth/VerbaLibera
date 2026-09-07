// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  EXPOSED_METHODS,
  createExposedApi,
} from "../desktop/preload-api";
import { createIpcHandlers } from "../desktop/ipc";

describe("desktop restricted preload API", () => {
  it("exposes exactly the five setup/recovery methods", () => {
    expect([...EXPOSED_METHODS].sort()).toEqual([
      "approveRemoteMigration",
      "chooseLocal",
      "inspectRemote",
      "restart",
      "revealLog",
    ]);
    const api = createExposedApi(async () => null);
    expect(Object.keys(api).sort()).toEqual([...EXPOSED_METHODS].sort());
  });

  it("routes each method to its narrow IPC channel", async () => {
    const invoke = vi.fn(async () => "ok");
    const api = createExposedApi(invoke);
    await api.inspectRemote("postgresql://u:p@h/db?sslmode=require");
    expect(invoke).toHaveBeenCalledWith(
      "verbalibera:inspectRemote",
      "postgresql://u:p@h/db?sslmode=require",
    );
  });
});

describe("desktop IPC sender policy", () => {
  function handlers() {
    return createIpcHandlers({
      allowedSenderUrls: [
        "file:///setup.html",
        "file:///recovery.html",
      ],
      flows: {
        chooseLocal: async () => ({ ok: true as const }),
        inspectRemote: async () => ({ pending: [], approvalToken: "t" }),
        approveRemoteMigration: async () => ({ ok: true as const }),
        revealLog: async () => {},
        restart: async () => {},
      },
    });
  }

  it("rejects invocations from unexpected sender frames", async () => {
    const h = handlers();
    const evil = { senderFrame: { url: "https://evil.example/" } };
    await expect(h["verbalibera:chooseLocal"](evil)).rejects.toThrow(/sender/i);
  });

  it("rejects cleartext remote inspection with REMOTE_TLS_REQUIRED", async () => {
    const h = handlers();
    const setup = { senderFrame: { url: "file:///setup.html" } };
    await expect(
      h["verbalibera:inspectRemote"](setup, "postgresql://u:p@db.example.com/app?sslmode=disable"),
    ).rejects.toMatchObject({ code: "REMOTE_TLS_REQUIRED" });
  });

  it("accepts setup-window invocations and validates arguments", async () => {
    const h = handlers();
    const setup = { senderFrame: { url: "file:///setup.html" } };
    await expect(h["verbalibera:chooseLocal"](setup)).resolves.toEqual({ ok: true });
    await expect(h["verbalibera:inspectRemote"](setup, 42)).rejects.toThrow(/string/i);
  });
});
