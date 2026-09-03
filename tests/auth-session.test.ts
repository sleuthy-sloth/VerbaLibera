import * as jose from 'jose';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  __setCachedKeyPairForTest,
  issueSessionToken,
  verifySessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
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
    expect(SESSION_COOKIE_NAME).toBe('voxlibre_session');
  });

  it('issues with short expiry for test and verifies before expiry', async () => {
    const token = await issueSessionToken('user-xyz', { privateKey: keyPair.privateKey, expiresInSeconds: 5 });
    const result = await verifySessionToken(token, { publicKey: keyPair.publicKey });
    expect(result?.userId).toBe('user-xyz');
  });
});
