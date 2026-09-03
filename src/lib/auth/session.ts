import 'server-only';

import * as jose from 'jose';

export const SESSION_COOKIE_NAME = 'voxlibre_session';
export const SESSION_DURATION_SECONDS = 30 * 60;
export const SESSION_ALG = 'ES256' as const;
export const SESSION_ISSUER = 'voxlibre';

type KeyPair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
};

let cachedKeyPair: KeyPair | null = null;
let cachedPublicKeyPem: string | null = null;
let cachedPrivateKeyPem: string | null = null;

function getEnvPem(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

async function loadKeyPairFromEnv(): Promise<KeyPair | null> {
  const privatePem = getEnvPem('AUTH_JWT_PRIVATE_KEY');
  const publicPem = getEnvPem('AUTH_JWT_PUBLIC_KEY');

  // Also support file paths for operator-managed disk keys
  const privatePath = getEnvPem('AUTH_JWT_PRIVATE_KEY_PATH');
  const publicPath = getEnvPem('AUTH_JWT_PUBLIC_KEY_PATH');

  let resolvedPrivatePem = privatePem;
  let resolvedPublicPem = publicPem;

  if (privatePath) {
    try {
      const fs = await import('node:fs/promises');
      resolvedPrivatePem = (await fs.readFile(privatePath, 'utf8')).trim();
    } catch {
      // fall through
    }
  }
  if (publicPath) {
    try {
      const fs = await import('node:fs/promises');
      resolvedPublicPem = (await fs.readFile(publicPath, 'utf8')).trim();
    } catch {
      // fall through
    }
  }

  if (resolvedPrivatePem && resolvedPublicPem) {
    if (cachedPrivateKeyPem === resolvedPrivatePem && cachedPublicKeyPem === resolvedPublicPem && cachedKeyPair) {
      return cachedKeyPair;
    }
    const privateKey = await jose.importPKCS8(resolvedPrivatePem, SESSION_ALG);
    const publicKey = await jose.importSPKI(resolvedPublicPem, SESSION_ALG);
    cachedPrivateKeyPem = resolvedPrivatePem;
    cachedPublicKeyPem = resolvedPublicPem;
    cachedKeyPair = { privateKey, publicKey };
    return cachedKeyPair;
  }

  // Single private key with embedded public: derive public from private if only private provided
  if (resolvedPrivatePem && !resolvedPublicPem) {
    // jose can import private and we can use same for verify via jose's JWK? For ES256 we need public; derive by importing private and using jose's ability to verify with private's public part via jose's key generation
    // As fallback, generate ephemeral and warn
  }

  return null;
}

async function getOrGenerateKeyPair(): Promise<KeyPair> {
  const envPair = await loadKeyPairFromEnv();
  if (envPair) return envPair;

  if (cachedKeyPair) return cachedKeyPair;

  // Ephemeral in-memory keypair for dev/test when no env is configured
  const { privateKey, publicKey } = await jose.generateKeyPair(SESSION_ALG);
  cachedKeyPair = { privateKey, publicKey };
  return cachedKeyPair;
}

export async function issueSessionToken(
  userId: string,
  options?: {
    privateKey?: CryptoKey;
    expiresInSeconds?: number;
  },
): Promise<string> {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('userId is required');
  }
  const keyPair = options?.privateKey ? { privateKey: options.privateKey, publicKey: null as unknown as CryptoKey } : await getOrGenerateKeyPair();
  const privateKey = options?.privateKey ?? keyPair.privateKey;
  const expiresIn = options?.expiresInSeconds ?? SESSION_DURATION_SECONDS;

  const token = await new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: SESSION_ALG })
    .setIssuedAt()
    .setIssuer(SESSION_ISSUER)
    .setSubject(userId)
    .setExpirationTime(`${expiresIn}s`)
    .sign(privateKey);

  return token;
}

export async function verifySessionToken(
  token: string,
  options?: {
    publicKey?: CryptoKey;
  },
): Promise<{ userId: string } | null> {
  if (!token || typeof token !== 'string') return null;
  try {
    const keyPair = options?.publicKey ? { publicKey: options.publicKey, privateKey: null as unknown as CryptoKey } : await getOrGenerateKeyPair();
    const publicKey = options?.publicKey ?? keyPair.publicKey;

    const { payload } = await jose.jwtVerify(token, publicKey, {
      issuer: SESSION_ISSUER,
    });

    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') return null;
    return { userId: sub };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function clearSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}

// For testing: allow injecting and clearing cached keys
export function __setCachedKeyPairForTest(pair: KeyPair | null) {
  cachedKeyPair = pair;
  if (!pair) {
    cachedPrivateKeyPem = null;
    cachedPublicKeyPem = null;
  }
}

export async function getSessionFromCookieHeader(cookieHeader: string | null): Promise<{ userId: string } | null> {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join('=');
      if (!value) return null;
      // Cookie value may be URL-encoded
      const token = decodeURIComponent(value);
      return verifySessionToken(token);
    }
  }
  return null;
}
