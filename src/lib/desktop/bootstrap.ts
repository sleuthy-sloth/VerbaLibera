import { timingSafeEqual } from "node:crypto";

// Per-launch bootstrap secret for desktop-local sessions (Task 7).
// The Electron main process sets the HTTP-only bootstrap cookie on its
// first local request; profile selection verifies it with a constant-time
// comparison and the bootstrap route consumes it (clears the cookie).

export const BOOTSTRAP_SECRET_ENV = "VERBALIBERA_BOOTSTRAP_SECRET";

export function expectedBootstrapSecret(): string | null {
  const value = process.env[BOOTSTRAP_SECRET_ENV];
  return value && value.length > 0 ? value : null;
}

export function verifyBootstrapSecret(candidate: string | null): boolean {
  const expected = expectedBootstrapSecret();
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
