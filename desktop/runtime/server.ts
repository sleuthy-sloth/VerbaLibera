// Fixed-origin Next.js supervisor for the desktop app (Task 5).
// Starts the staged server.js with loopback-only env, then gates on the
// per-install health identity. Never falls back to another port: a
// respondent is either our server (matching identity) or an occupant.
import { APP_ORIGIN, APP_PORT } from "../security/urls";
import { desktopFailure, type DesktopFailure } from "./errors";
import { waitForHealth, type HealthSnapshot } from "./health";

export interface LaunchedServer {
  pid: number;
  kill: () => void;
  exited: Promise<number>;
}

export interface RunningServer extends LaunchedServer {
  port: number;
  origin: string;
}

export interface ServerContext {
  serverEntry: string;
  databaseUrl: string;
  desktopMode: "local" | "remote";
  bootstrapSecret: string;
  healthIdentity: string;
  appVersion: string;
  jwtPrivateKeyPath: string;
  jwtPublicKeyPath: string;
  launch: (
    entry: string,
    env: Record<string, string>,
  ) => Promise<LaunchedServer>;
  fetchHealth: (url: string) => Promise<HealthSnapshot | null>;
  sleep: (ms: number) => Promise<void>;
  /** Test override; production uses 15s/100ms. */
  healthTimeoutMs?: number;
  healthPollMs?: number;
}

export const HEALTH_PATH = "/api/desktop/health";

export function healthUrl(): string {
  return `${APP_ORIGIN}${HEALTH_PATH}`;
}

export async function startApplicationServer(
  context: ServerContext,
): Promise<RunningServer> {
  const url = healthUrl();
  let existing: HealthSnapshot | null = null;
  try {
    existing = await context.fetchHealth(url);
  } catch {
    existing = null;
  }
  if (existing !== null) {
    throw desktopFailure(
      "APP_PORT_OCCUPIED",
      existing.identity === context.healthIdentity
        ? "Application server is already running for this installation."
        : "Application port is occupied by another program.",
    ) as DesktopFailure;
  }

  const appUrl = new URL(APP_ORIGIN);
  const env: Record<string, string> = {
    HOSTNAME: "127.0.0.1",
    PORT: String(APP_PORT),
    DATABASE_URL: context.databaseUrl,
    VERBALIBERA_DESKTOP_MODE: context.desktopMode,
    VERBALIBERA_HEALTH_IDENTITY: context.healthIdentity,
    VERBALIBERA_BOOTSTRAP_SECRET: context.bootstrapSecret,
    VERBALIBERA_APP_VERSION: context.appVersion,
    CONTENT_VERSION: context.appVersion,
    AUTH_JWT_PRIVATE_KEY_PATH: context.jwtPrivateKeyPath,
    AUTH_JWT_PUBLIC_KEY_PATH: context.jwtPublicKeyPath,
    // The renderer runs at the fixed loopback origin, so the child server
    // must verify passkeys against it — never the localhost:3000 default.
    WEBAUTHN_RP_ID: appUrl.hostname,
    WEBAUTHN_ORIGIN: appUrl.origin,
  };
  const launched = await context.launch(context.serverEntry, env);
  try {
    await waitForHealth({
      url,
      identity: context.healthIdentity,
      version: context.appVersion,
      timeoutMs: context.healthTimeoutMs ?? 15_000,
      pollMs: context.healthPollMs ?? 100,
      fetchHealth: context.fetchHealth,
      reap: () => launched.kill(),
      sleep: context.sleep,
    });
  } catch (error) {
    launched.kill();
    throw error;
  }
  return { ...launched, port: APP_PORT, origin: APP_ORIGIN };
}
