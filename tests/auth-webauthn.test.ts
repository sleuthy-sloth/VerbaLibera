import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@simplewebauthn/server', async () => {
  const actual = await vi.importActual<typeof import('@simplewebauthn/server')>('@simplewebauthn/server');
  return {
    ...actual,
    generateRegistrationOptions: vi.fn(async (opts: never) => ({
      rp: { name: 'VerbaLibera', id: 'localhost' },
      user: { id: (opts as { userID: string }).userID, name: (opts as { userName: string }).userName, displayName: '' },
      challenge: 'test-challenge-reg',
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      timeout: 60000,
      attestation: 'none',
      excludeCredentials: [],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    })),
    verifyRegistrationResponse: vi.fn(async ({ response, expectedChallenge }: { response: unknown; expectedChallenge: string }) => {
      const res = response as { id?: string };
      if (expectedChallenge !== 'test-challenge-reg') {
        return { verified: false } as never;
      }
      return {
        verified: true,
        registrationInfo: {
          credential: {
            id: (res.id as string) ?? 'cred-123',
            publicKey: new Uint8Array([1, 2, 3, 4]),
            counter: 0,
            transports: ['internal'],
          },
        },
      } as never;
    }),
    generateAuthenticationOptions: vi.fn(async (opts: never) => ({
      challenge: 'test-challenge-auth',
      timeout: 60000,
      userVerification: 'preferred',
      rpId: 'localhost',
      allowCredentials: (opts as { allowCredentials?: unknown[] }).allowCredentials ?? [],
    })),
    verifyAuthenticationResponse: vi.fn(async ({ response, expectedChallenge, credential }: { response: unknown; expectedChallenge: string; credential: { counter: number } }) => {
      if (expectedChallenge !== 'test-challenge-auth') {
        return { verified: false } as never;
      }
      const res = response as { id?: string };
      if (!res.id) return { verified: false } as never;
      return {
        verified: true,
        authenticationInfo: { newCounter: credential.counter + 1 },
      } as never;
    }),
  };
});

import {
  createAuthenticationOptions,
  createRegistrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from '../src/lib/auth/webauthn';

describe('auth webauthn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates registration options with challenge', async () => {
    const opts = await createRegistrationOptions({
      userId: 'user-123',
      userName: 'test@example.com',
    });
    expect(opts.challenge).toBe('test-challenge-reg');
    expect(opts.rp.id).toBe('localhost');
    expect(opts.user.name).toBe('test@example.com');
  });

  it('verifies registration with fixture challenge', async () => {
    const result = await verifyRegistration({
      response: { id: 'cred-123', rawId: 'cred-123', response: {}, clientExtensionResults: {}, type: 'public-key' } as never,
      expectedChallenge: 'test-challenge-reg',
    });
    expect(result.verified).toBe(true);
    expect(result.credential?.credentialId).toBe('cred-123');
    expect(result.credential?.publicKey).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(result.credential?.counter).toBe(0);
  });

  it('rejects registration with wrong challenge', async () => {
    const result = await verifyRegistration({
      response: { id: 'cred-123', rawId: 'cred-123', response: {}, clientExtensionResults: {}, type: 'public-key' } as never,
      expectedChallenge: 'wrong-challenge',
    });
    expect(result.verified).toBe(false);
  });

  it('creates authentication options', async () => {
    const opts = await createAuthenticationOptions({
      existingCredentials: [{ credentialId: 'cred-123', publicKey: new Uint8Array([1]), counter: 0 }],
    });
    expect(opts.challenge).toBe('test-challenge-auth');
  });

  it('verifies authentication and increments counter', async () => {
    const result = await verifyAuthentication({
      response: { id: 'cred-123', rawId: 'cred-123', response: { authenticatorData: '', clientDataJSON: '', signature: '' }, clientExtensionResults: {}, type: 'public-key' } as never,
      expectedChallenge: 'test-challenge-auth',
      credential: { credentialId: 'cred-123', publicKey: new Uint8Array([1, 2, 3]), counter: 5 },
    });
    expect(result.verified).toBe(true);
    expect(result.newCounter).toBe(6);
  });

  it('rejects authentication with wrong challenge', async () => {
    const result = await verifyAuthentication({
      response: { id: 'cred-123', rawId: 'cred-123', response: { authenticatorData: '', clientDataJSON: '', signature: '' }, clientExtensionResults: {}, type: 'public-key' } as never,
      expectedChallenge: 'wrong',
      credential: { credentialId: 'cred-123', publicKey: new Uint8Array([1]), counter: 5 },
    });
    expect(result.verified).toBe(false);
  });
});
