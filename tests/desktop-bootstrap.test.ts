import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  issueSessionToken: vi.fn(),
  profileFindUnique: vi.fn(),
  profileFindMany: vi.fn(),
  userCreate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  issueSessionToken: db.issueSessionToken,
  getSessionCookieName: () => "verbalibera_session",
  sessionCookieOptions: () => ({
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    desktopProfile: {
      findUnique: db.profileFindUnique,
      findMany: db.profileFindMany,
    },
    user: { create: db.userCreate },
  },
}));

import { GET as healthGet } from "@/app/api/desktop/health/route";
import {
  GET as profilesGet,
  POST as profilesPost,
} from "@/app/api/desktop/profiles/route";
import { POST as bootstrapPost } from "@/app/api/desktop/bootstrap/route";

const ORIGIN = "http://127.0.0.1:43127";
const SECRET = "test-bootstrap-secret";

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of [
    "VERBALIBERA_DESKTOP_MODE",
    "VERBALIBERA_BOOTSTRAP_SECRET",
    "VERBALIBERA_HEALTH_IDENTITY",
    "VERBALIBERA_APP_VERSION",
  ]) {
    savedEnv[key] = process.env[key];
  }
  process.env.VERBALIBERA_DESKTOP_MODE = "local";
  process.env.VERBALIBERA_BOOTSTRAP_SECRET = SECRET;
  process.env.VERBALIBERA_HEALTH_IDENTITY = "install-1";
  process.env.VERBALIBERA_APP_VERSION = "0.1.0";
  vi.resetAllMocks();
  db.issueSessionToken.mockResolvedValue("signed-token");
  db.profileFindUnique.mockResolvedValue({
    userId: "u1",
    displayName: "Ada",
    user: { id: "u1", isDesktopLocal: true },
  });
  db.profileFindMany.mockResolvedValue([]);
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function bootstrapRequest(
  secret: string | null,
  headers: Record<string, string> = {},
): Request {
  const cookies =
    secret === null
      ? "verbalibera_csrf=abc"
      : `verbalibera_bootstrap=${secret}; verbalibera_csrf=abc`;
  return new Request(`${ORIGIN}/api/desktop/bootstrap`, {
    method: "POST",
    headers: {
      origin: ORIGIN,
      cookie: cookies,
      "x-csrf-token": "abc",
      ...headers,
    },
    body: JSON.stringify({ profileId: "u1" }),
  });
}

describe("desktop bootstrap session", () => {
  it("returns 404 outside local desktop mode", async () => {
    delete process.env.VERBALIBERA_DESKTOP_MODE;
    expect((await bootstrapPost(bootstrapRequest(SECRET))).status).toBe(404);
    expect(
      (
        await profilesGet(
          new Request(`${ORIGIN}/api/desktop/profiles`, {
            headers: { origin: ORIGIN },
          }),
        )
      ).status,
    ).toBe(404);
    expect((await healthGet()).status).toBe(404);
  });

  it("rejects non-loopback, bad origin, and bad bootstrap secret", async () => {
    expect(
      (
        await bootstrapPost(
          bootstrapRequest(SECRET, { "x-forwarded-for": "10.0.0.2" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await bootstrapPost(
          bootstrapRequest(SECRET, { origin: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
    expect((await bootstrapPost(bootstrapRequest("wrong"))).status).toBe(403);
    expect((await bootstrapPost(bootstrapRequest(null))).status).toBe(403);
    expect(db.issueSessionToken).not.toHaveBeenCalled();
  });

  it("issues the existing HTTP-only session cookie for a selected local profile", async () => {
    const response = await bootstrapPost(bootstrapRequest(SECRET));
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/verbalibera_session=.*HttpOnly/);
    // The one-shot bootstrap secret is consumed on selection.
    expect(setCookie).toMatch(/verbalibera_bootstrap=;/);
    expect(db.issueSessionToken).toHaveBeenCalledWith("u1");
  });

  it("refuses profiles that are not desktop-local", async () => {
    db.profileFindUnique.mockResolvedValue({
      userId: "u1",
      displayName: "Ada",
      user: { id: "u1", isDesktopLocal: false },
    });
    expect((await bootstrapPost(bootstrapRequest(SECRET))).status).toBe(404);
  });
});

describe("desktop profiles", () => {
  it("lists only profile ids and display names", async () => {
    db.profileFindMany.mockResolvedValue([
      { userId: "u1", displayName: "Ada" },
    ]);
    const response = await profilesGet(
      new Request(`${ORIGIN}/api/desktop/profiles`, {
        headers: { origin: ORIGIN },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profiles: [{ id: "u1", displayName: "Ada" }],
    });
  });

  it("creates desktop-local users with internal identifiers", async () => {
    db.userCreate.mockResolvedValue({
      id: "u2",
      desktopProfile: { displayName: "Bo" },
    });
    const response = await profilesPost(
      new Request(`${ORIGIN}/api/desktop/profiles`, {
        method: "POST",
        headers: { origin: ORIGIN },
        body: JSON.stringify({ displayName: "Bo" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(db.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountIdentifier: expect.stringMatching(/^desktop-local:/),
          isDesktopLocal: true,
        }),
      }),
    );
    expect(await response.json()).toEqual({ id: "u2", displayName: "Bo" });
  });
});

describe("desktop cookie security", () => {
  it("drops the Secure flag on loopback desktop HTTP", async () => {
    const prevNode = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = "production";
    const { cookieSecure } = await import("@/lib/auth/cookie-secure");
    expect(cookieSecure()).toBe(false);
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = prevNode;
  });
});

describe("desktop health", () => {
  it("reports the install identity and app version in desktop mode", async () => {
    delete process.env.WEBAUTHN_RP_ID;
    delete process.env.WEBAUTHN_ORIGIN;
    const response = await healthGet();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      identity: "install-1",
      version: "0.1.0",
      webauthn: { rpID: "localhost", origin: "http://localhost:3000" },
    });
  });

  it("echoes the fixed-origin WebAuthn values the child server verifies against", async () => {
    process.env.WEBAUTHN_RP_ID = "127.0.0.1";
    process.env.WEBAUTHN_ORIGIN = "http://127.0.0.1:43127";
    try {
      const response = await healthGet();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        identity: "install-1",
        version: "0.1.0",
        webauthn: { rpID: "127.0.0.1", origin: "http://127.0.0.1:43127" },
      });
    } finally {
      delete process.env.WEBAUTHN_RP_ID;
      delete process.env.WEBAUTHN_ORIGIN;
    }
  });
});
