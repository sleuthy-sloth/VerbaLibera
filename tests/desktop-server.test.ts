// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  startApplicationServer,
  type ServerContext,
} from "../desktop/runtime/server";
import { waitForHealth } from "../desktop/runtime/health";

function baseContext(overrides: Partial<ServerContext> = {}): ServerContext {
  return {
    serverEntry: "/staged/server/server.js",
    databaseUrl: "postgresql://verbalibera:x@127.0.0.1:1/verbalibera",
    desktopMode: "local",
    bootstrapSecret: "test-bootstrap-secret",
    healthIdentity: "test-install-identity",
    appVersion: "0.1.0",
    jwtPrivateKeyPath: "/data/jwt-private.pem",
    jwtPublicKeyPath: "/data/jwt-public.pem",
    launch: async () => ({
      pid: 1111,
      kill: () => {},
      exited: new Promise<number>(() => {}),
    }),
    fetchHealth: async () => null,
    sleep: async () => {},
    healthTimeoutMs: 500,
    healthPollMs: 5,
    ...overrides,
  };
}

describe("desktop application server", () => {
  it("rejects an occupied port with the wrong installation identity", async () => {
    await expect(
      startApplicationServer(
        baseContext({
          fetchHealth: async () => ({
            identity: "someone-else",
            version: "0.1.0",
          }),
        }),
      ),
    ).rejects.toMatchObject({ code: "APP_PORT_OCCUPIED" });
  });

  it("starts the staged server with loopback-only env and waits for identity", async () => {
    const launch = vi.fn(async () => ({
      pid: 2222,
      kill: () => {},
      exited: new Promise<number>(() => {}),
    }));
    const seen: Array<{ identity: string; version: string } | null> = [
      null,
      { identity: "test-install-identity", version: "0.1.0" },
    ];
    const server = await startApplicationServer(
      baseContext({
        launch,
        fetchHealth: async () => seen.shift() ?? null,
      }),
    );
    expect(server.port).toBe(43127);
    const launchCalls = launch.mock.calls as unknown as Array<
      [string, Record<string, string>]
    >;
    const [, env] = launchCalls[0];
    expect(env.HOSTNAME).toBe("127.0.0.1");
    expect(env.PORT).toBe("43127");
    expect(env.DATABASE_URL).toMatch(/^postgresql:\/\//);
    expect(env.VERBALIBERA_DESKTOP_MODE).toBe("local");
    expect(env.VERBALIBERA_HEALTH_IDENTITY).toBe("test-install-identity");
    expect(env.AUTH_JWT_PRIVATE_KEY_PATH).toBe("/data/jwt-private.pem");
    expect(String(env.DATABASE_URL)).not.toContain("bootstrap");
    expect(env.VERBALIBERA_BOOTSTRAP_SECRET).toBe("test-bootstrap-secret");
  });

  it("passes the fixed-origin WebAuthn configuration to the child server", async () => {
    const launch = vi.fn(async () => ({
      pid: 4444,
      kill: () => {},
      exited: new Promise<number>(() => {}),
    }));
    const seen: Array<{ identity: string; version: string } | null> = [
      null,
      { identity: "test-install-identity", version: "0.1.0" },
    ];
    await startApplicationServer(
      baseContext({
        launch,
        fetchHealth: async () => seen.shift() ?? null,
      }),
    );
    const launchCalls = launch.mock.calls as unknown as Array<
      [string, Record<string, string>]
    >;
    const [, env] = launchCalls[0];
    expect(env.WEBAUTHN_RP_ID).toBe("127.0.0.1");
    expect(env.WEBAUTHN_ORIGIN).toBe("http://127.0.0.1:43127");
  });

  it("never falls back to a different application port", async () => {
    const launch = vi.fn(async () => ({
      pid: 3333,
      kill: () => {},
      exited: new Promise<number>(() => {}),
    }));
    await expect(
      startApplicationServer(
        baseContext({ launch, fetchHealth: async () => null }),
      ),
    ).rejects.toMatchObject({ code: "SERVER_HEALTH_TIMEOUT" });
    expect(launch.mock.calls.length).toBe(1);
  });
});

describe("desktop health gate", () => {
  it("times out and reaps a server that never becomes healthy", async () => {
    const kill = vi.fn();
    await expect(
      waitForHealth({
        url: "http://127.0.0.1:43127/api/desktop/health",
        identity: "id",
        version: "0.1.0",
        timeoutMs: 1000,
        pollMs: 100,
        fetchHealth: async () => null,
        reap: kill,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ code: "SERVER_HEALTH_TIMEOUT" });
    expect(kill).toHaveBeenCalledOnce();
  });

  it("accepts only the matching identity and version", async () => {
    const reap = vi.fn();
    await expect(
      waitForHealth({
        url: "http://127.0.0.1:43127/api/desktop/health",
        identity: "id",
        version: "0.1.0",
        timeoutMs: 1000,
        pollMs: 100,
        fetchHealth: async () => ({ identity: "id", version: "9.9.9" }),
        reap,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ code: "SERVER_VERSION_MISMATCH" });
    expect(reap).toHaveBeenCalledOnce();
  });
});
