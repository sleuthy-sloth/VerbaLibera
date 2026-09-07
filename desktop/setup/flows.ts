// First-launch setup flows (Task 6).
// Local choice persists settings only after database init, migration, and
// server start all succeed. Remote inspection validates TLS, tests SELECT 1,
// returns the exact pending migrations, and issues a one-use approval token
// held in main-process memory for five minutes.
import { randomBytes } from "node:crypto";
import { saveSettings, type DesktopSettings } from "../settings/store";

export interface LocalSetupDeps {
  userDataDir: string;
  schemaVersion: string;
  initDatabase: () => Promise<{ databaseUrl: string; dataDir: string }>;
  migrate: (args: { databaseUrl: string; dataDir: string }) => Promise<void>;
  startServer: (args: { databaseUrl: string }) => Promise<void>;
}

export async function runLocalSetup(
  deps: LocalSetupDeps,
): Promise<DesktopSettings> {
  const { databaseUrl, dataDir } = await deps.initDatabase();
  await deps.migrate({ databaseUrl, dataDir });
  await deps.startServer({ databaseUrl });
  const settings: DesktopSettings = {
    version: 1,
    active: { mode: "local", schemaVersion: deps.schemaVersion },
  };
  saveSettings(deps.userDataDir, settings);
  return settings;
}

export interface ApprovalToken {
  url: string;
  expiresAt: number;
}

export interface RemoteInspectDeps {
  tokens: Map<string, ApprovalToken>;
  now: () => number;
  testConnection: (url: string) => Promise<void>;
  listPending: (url: string) => Promise<string[]>;
}

const APPROVAL_TTL_MS = 5 * 60_000;

export async function inspectRemoteSetup(
  url: string,
  deps: RemoteInspectDeps,
): Promise<{ pending: string[]; approvalToken: string }> {
  await deps.testConnection(url);
  const pending = await deps.listPending(url);
  const approvalToken = randomBytes(32).toString("base64url");
  deps.tokens.set(approvalToken, {
    url,
    expiresAt: deps.now() + APPROVAL_TTL_MS,
  });
  return { pending, approvalToken };
}

export interface RemoteApproveDeps {
  tokens: Map<string, ApprovalToken>;
  now: () => number;
  finish: (url: string) => Promise<{ ok: true }>;
}

export async function approveRemoteSetup(
  token: string,
  deps: RemoteApproveDeps,
): Promise<{ ok: true }> {
  const record = deps.tokens.get(token);
  deps.tokens.delete(token);
  if (!record) {
    throw new Error("Unknown or already-used migration approval token.");
  }
  if (deps.now() > record.expiresAt) {
    throw new Error("Migration approval token expired.");
  }
  return deps.finish(record.url);
}
