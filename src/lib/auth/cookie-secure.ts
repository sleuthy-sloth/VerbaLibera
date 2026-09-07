// Cookie security helper shared by session, CSRF, and challenge cookies.
// Production HTTPS deployments keep Secure cookies. The desktop server
// always binds loopback-only plain HTTP (127.0.0.1:43127), where Secure
// cookies would be rejected by the browser and sessions could never
// persist; the loopback binding (plus the Electron navigation guards) is
// the transport protection there.
export function cookieSecure(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (process.env.VERBALIBERA_DESKTOP_MODE) return false;
  return true;
}
