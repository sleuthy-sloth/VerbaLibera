// Per-install ES256 JWT key pair for the desktop server (Task 6).
// Generated once into the app user-data directory (0600) and passed to the
// staged server via AUTH_JWT_*_PATH, which the hosted session code already
// supports. Sessions survive restarts on the same Mac and never leave it.
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface JwtKeyPaths {
  privatePath: string;
  publicPath: string;
}

export function ensureJwtKeys(dir: string): JwtKeyPaths {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const privatePath = path.join(dir, "jwt-private.pem");
  const publicPath = path.join(dir, "jwt-public.pem");
  if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
    const publicPem = publicKey.export({ type: "spki", format: "pem" });
    fs.writeFileSync(privatePath, privatePem, { mode: 0o600 });
    fs.writeFileSync(publicPath, publicPem, { mode: 0o600 });
  }
  fs.chmodSync(privatePath, 0o600);
  fs.chmodSync(publicPath, 0o600);
  return { privatePath, publicPath };
}
