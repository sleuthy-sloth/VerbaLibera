// Fixed-origin health gate for the desktop application server (Task 5).
// Polls `/api/desktop/health` and accepts only the matching per-install
// identity and app version. Anything else is a foreign occupant or a
// version-skewed server, never "our" server.
import { desktopFailure } from "./errors";

export interface HealthSnapshot {
  identity: string;
  version: string;
  /** Echoed ceremony values; the supervisor gate verifies identity/version only. */
  webauthn?: { rpID: string; origin: string };
}

export interface HealthGate {
  url: string;
  identity: string;
  version: string;
  timeoutMs: number;
  pollMs: number;
  fetchHealth: (url: string) => Promise<HealthSnapshot | null>;
  reap: () => void;
  sleep: (ms: number) => Promise<void>;
}

export async function waitForHealth(gate: HealthGate): Promise<HealthSnapshot> {
  const deadline = Date.now() + gate.timeoutMs;
  let last: HealthSnapshot | null = null;
  while (Date.now() < deadline) {
    try {
      last = await gate.fetchHealth(gate.url);
    } catch {
      last = null;
    }
    if (last !== null) {
      if (last.identity !== gate.identity) {
        gate.reap();
        throw desktopFailure(
          "APP_PORT_OCCUPIED",
          "Application port is occupied by another installation.",
        );
      }
      if (last.version !== gate.version) {
        gate.reap();
        throw desktopFailure(
          "SERVER_VERSION_MISMATCH",
          `Server version ${last.version} does not match app ${gate.version}.`,
        );
      }
      return last;
    }
    await gate.sleep(gate.pollMs);
  }
  gate.reap();
  throw desktopFailure(
    "SERVER_HEALTH_TIMEOUT",
    "Application server did not become healthy in time.",
  );
}
