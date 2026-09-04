import * as jose from 'jose';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  __setCachedKeyPairForTest,
  issueSessionToken,
  verifySessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  getSessionFromCookieHeader,
} from '../src/lib/auth/session';

describe('auth session', () => {
  let keyPair: { privateKey: CryptoKey; publicKey: CryptoKey };
  let otherKeyPair: { privateKey: CryptoKey; publicKey: CryptoKey };

  beforeEach(async () => {
    keyPair = await jose.generateKeyPair('ES256');
    otherKeyPair = await jose.generateKeyPair('ES256');
    __setCachedKeyPairForTest(null);
  });

  it('issues and verifies a session token round-trip', async () => {
    const token = await issueSessionToken('user-123', { privateKey: keyPair.privateKey });
    const result = await verifySessionToken(token, { publicKey: keyPair.publicKey });
    expect(result).toEqual({ userId: 'user-123' });
  });

  it('rejects tampered token', async () => {
    const token = await issueSessionToken('user-123', { privateKey: keyPair.privateKey });
    const tampered = token.slice(0, -2) + 'ab';
    const result = await verifySessionToken(tampered, { publicKey: keyPair.publicKey });
    expect(result).toBeNull();
  });

  it('rejects token signed with different key', async () => {
    const token = await issueSessionToken('user-123', { privateKey: keyPair.privateKey });
    const result = await verifySessionToken(token, { publicKey: otherKeyPair.publicKey });
    expect(result).toBeNull();
  });

  it('rejects expired token', async () => {
    const token = await issueSessionToken('user-123', { privateKey: keyPair.privateKey, expiresInSeconds: -10 });
    const result = await verifySessionToken(token, { publicKey: keyPair.publicKey });
    expect(result).toBeNull();
  });

  it('rejects empty and malformed tokens', async () => {
    expect(await verifySessionToken('', { publicKey: keyPair.publicKey })).toBeNull();
    expect(await verifySessionToken('not.a.jwt', { publicKey: keyPair.publicKey })).toBeNull();
    expect(await verifySessionToken(null as unknown as string, { publicKey: keyPair.publicKey })).toBeNull();
  });

  it('uses 30-minute cookie options', () => {
    const opts = sessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(SESSION_DURATION_SECONDS);
    expect(opts.maxAge).toBe(1800);
    expect(SESSION_COOKIE_NAME).toBe('verbalibera_session');
  });

  it('issues with short expiry for test and verifies before expiry', async () => {
    const token = await issueSessionToken('user-xyz', { privateKey: keyPair.privateKey, expiresInSeconds: 5 });
    const result = await verifySessionToken(token, { publicKey: keyPair.publicKey });
    expect(result?.userId).toBe('user-xyz');
  });

  it('warns and sets isEphemeral when no AUTH_JWT_* PEM is configured', async () => {
    const savedPrivate = process.env.AUTH_JWT_PRIVATE_KEY;
    const savedPublic = process.env.AUTH_JWT_PUBLIC_KEY;
    const savedPrivatePath = process.env.AUTH_JWT_PRIVATE_KEY_PATH;
    const savedPublicPath = process.env.AUTH_JWT_PUBLIC_KEY_PATH;
    delete process.env.AUTH_JWT_PRIVATE_KEY;
    delete process.env.AUTH_JWT_PUBLIC_KEY;
    delete process.env.AUTH_JWT_PRIVATE_KEY_PATH;
    delete process.env.AUTH_JWT_PUBLIC_KEY_PATH;
    __setCachedKeyPairForTest(null);
    // Force re-import after clearing env to trigger ephemeral path
    const fresh = await import('../src/lib/auth/session');
    const getOrGenerate = (fresh as unknown as { getOrGenerateKeyPair?: () => Promise<unknown> }).getOrGenerateKeyPair;
    const loadKeyPair = (fresh as unknown as { loadKeyPairFromEnv?: () => Promise<unknown> }).loadKeyPairFromEnv;
    if (getOrGenerate) {
      await getOrGenerate();
    } else if (loadKeyPair) {
      await loadKeyPair();
      await fresh.issueSessionToken('ephemeral-test-user');
    } else {
      await fresh.issueSessionToken('ephemeral-test-user');
    }
    const modAny = fresh as unknown as Record<string, unknown>;
    const isEphemeralBool = modAny.isEphemeralSession === true || (modAny as unknown as { isEphemeral?: boolean }).isEphemeral === true;
    const warningVal =
      (modAny.ephemeralWarning as string | null) ??
      (Array.isArray(modAny.warnings) ? (modAny.warnings as string[]).join(' ') : undefined) ??
      (typeof modAny.getEphemeralWarning === 'function' ? (modAny.getEphemeralWarning as () => unknown)() : undefined);
    const warningStr = String(warningVal ?? '');
    // Either boolean flag or warning string must indicate ephemeral
    expect(isEphemeralBool || /ephemeral/i.test(warningStr)).toBe(true);
    // If warning string is present, it must match
    if (warningStr) expect(warningStr).toMatch(/ephemeral/i);
    else expect(isEphemeralBool).toBe(true);
    expect(typeof getOrGenerate === 'function' || typeof loadKeyPair === 'function').toBe(true);
    // restore
    if (savedPrivate !== undefined) process.env.AUTH_JWT_PRIVATE_KEY = savedPrivate;
    else delete process.env.AUTH_JWT_PRIVATE_KEY;
    if (savedPublic !== undefined) process.env.AUTH_JWT_PUBLIC_KEY = savedPublic;
    else delete process.env.AUTH_JWT_PUBLIC_KEY;
    if (savedPrivatePath !== undefined) process.env.AUTH_JWT_PRIVATE_KEY_PATH = savedPrivatePath;
    else delete process.env.AUTH_JWT_PRIVATE_KEY_PATH;
    if (savedPublicPath !== undefined) process.env.AUTH_JWT_PUBLIC_KEY_PATH = savedPublicPath;
    else delete process.env.AUTH_JWT_PUBLIC_KEY_PATH;
    __setCachedKeyPairForTest(null);
  });

  it('uses __Host- prefix for session cookie in production', async () => {
    const prev = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'production';
    const mod = await import('../src/lib/auth/session');
    const nameViaFn =
      typeof (mod as unknown as { getSessionCookieName?: () => string }).getSessionCookieName === 'function'
        ? (mod as unknown as { getSessionCookieName: () => string }).getSessionCookieName()
        : (mod as unknown as { SESSION_COOKIE_NAME: string }).SESSION_COOKIE_NAME;
    expect(nameViaFn).toBe('__Host-verbalibera_session');
    const opts = mod.sessionCookieOptions();
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = prev;
  });

  it('reads session from both legacy and __Host- cookie names', async () => {
    const token = await issueSessionToken('user-both', { privateKey: keyPair.privateKey });
    // Use static imported function and setter so they share same module cache
    __setCachedKeyPairForTest(keyPair as unknown as never);
    const legacyHeader = `verbalibera_session=${encodeURIComponent(token)}`;
    const hostHeader = `__Host-verbalibera_session=${encodeURIComponent(token)}`;
    const legacyRes = await getSessionFromCookieHeader(legacyHeader);
    const hostRes = await getSessionFromCookieHeader(hostHeader);
    expect(legacyRes?.userId).toBe('user-both');
    expect(hostRes?.userId).toBe('user-both');
    __setCachedKeyPairForTest(null);
  });
});
