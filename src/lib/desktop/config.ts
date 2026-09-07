// Desktop-mode request boundaries shared by routes and proxy (Task 7).
// The desktop server binds loopback-only; these guards additionally reject
// non-local origins, forwarded non-loopback clients, and anything outside
// local desktop mode.

export const DESKTOP_PORT = 43127;
export const DESKTOP_ORIGIN = `http://127.0.0.1:${DESKTOP_PORT}`;
export const DESKTOP_MODE_ENV = "VERBALIBERA_DESKTOP_MODE";
export const BOOTSTRAP_COOKIE = "verbalibera_bootstrap";
export const BOOTSTRAP_HEADER = "x-bootstrap-token";

export type DesktopMode = "local" | "remote";

export function desktopMode(): DesktopMode | null {
  const mode = process.env[DESKTOP_MODE_ENV];
  return mode === "local" || mode === "remote" ? mode : null;
}

export function isLocalDesktopMode(): boolean {
  return desktopMode() === "local";
}

export function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "").split(":")[0];
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

/** First client address when the server sits behind a forwarder, if any. */
export function forwardedClient(request: Request): string | null {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  return first ? first : null;
}

/** Exact origin match against the fixed local application origin. */
export function hasDesktopOrigin(request: Request): boolean {
  return request.headers.get("origin") === DESKTOP_ORIGIN;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return part.slice(index + 1).trim();
      }
    }
  }
  return null;
}
