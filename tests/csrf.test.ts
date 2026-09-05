vi.mock('@/lib/auth/challenge', () => ({ consumeChallenge: vi.fn(async () => ({ challenge: 'test-challenge', accountIdentifier: 'test@example.com' })), CHALLENGE_COOKIE: 'verbalibera_challenge' }));
import { describe, it, expect, vi } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken, validateCsrfRequest, csrfCookieOptions } from '../src/lib/auth/csrf';

// Mocks for login route CSRF rotation test
vi.mock('@/lib/prisma', () => ({
  prisma: {
    credential: {
      findUnique: vi.fn(async () => ({
        credentialId: 'cred-123',
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        transports: 'internal',
        userId: 'user-123',
      })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    },
    user: {
      upsert: vi.fn(async () => ({ id: 'user-123' })),
    },
    credential2: {},
  },
}));
vi.mock('@/lib/auth/webauthn', () => ({
  verifyAuthentication: vi.fn(async () => ({ verified: true, newCounter: 1 })),
  verifyRegistration: vi.fn(async () => ({
    verified: true,
    credential: { credentialId: 'cred-123', publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
  })),
}));

describe('csrf double-submit', () => {
  it('generates a base64url token', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(20);
  });

  it('validates matching cookie and header', () => {
    const token = generateCsrfToken();
    const request = new Request('http://localhost/api/progress/review', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    });
    expect(validateCsrfRequest(request)).toBe(true);
  });

  it('rejects mismatched tokens', () => {
    const token = generateCsrfToken();
    const other = generateCsrfToken();
    const request = new Request('http://localhost/api/progress/review', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: other,
      },
    });
    expect(validateCsrfRequest(request)).toBe(false);
  });

  it('rejects missing header', () => {
    const token = generateCsrfToken();
    const request = new Request('http://localhost/api/progress/review', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
      },
    });
    expect(validateCsrfRequest(request)).toBe(false);
  });

  it('rejects missing cookie', () => {
    const token = generateCsrfToken();
    const request = new Request('http://localhost/api/progress/review', {
      method: 'POST',
      headers: {
        [CSRF_HEADER_NAME]: token,
      },
    });
    expect(validateCsrfRequest(request)).toBe(false);
  });

  it('csrfCookieOptions uses Secure/SameSite=Lax/HttpOnly false', () => {
    const prev = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'production';
    const opts = csrfCookieOptions();
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(false);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = prev;
  });

  it('rotates CSRF token on login (sets new csrf cookie)', async () => {
    const { POST } = await import('../src/app/api/auth/login/route');
    const oldToken = generateCsrfToken();
    const body = {
      authenticationResponse: { id: 'cred-123', rawId: 'cred-123', response: {}, clientExtensionResults: {}, type: 'public-key' },
      expectedChallenge: 'test-challenge',
    };
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${CSRF_COOKIE_NAME}=${oldToken}`,
      },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    // Login may be 400 if challenge invalid, but we mocked verify to succeed regardless? Expected challenge check may fail if not matched.
    // Our mock always returns verified true, so login should succeed with token set.
    // Check that response sets csrf cookie with different token
    const setCookie = res.headers.get('set-cookie') ?? '';
    // Also check via cookies API
    const csrfCookie = (res as unknown as { cookies: { get: (n: string) => { value: string } | undefined } }).cookies?.get?.(CSRF_COOKIE_NAME);
    const hasCsrfViaHeader = setCookie.includes(CSRF_COOKIE_NAME);
    const hasCsrfViaApi = !!csrfCookie;
    expect(hasCsrfViaHeader || hasCsrfViaApi).toBe(true);
    if (csrfCookie) {
      expect(csrfCookie.value).not.toBe(oldToken);
      expect(csrfCookie.value.length).toBeGreaterThan(20);
    } else {
      // fallback header check: extract token
      const match = setCookie.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`));
      expect(match).not.toBeNull();
      expect(match![1]).not.toBe(oldToken);
    }
  });

  it('login sets __Host- session cookie with Secure/HttpOnly/SameSite=Lax in production', async () => {
    const prev = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'production';
    const { POST } = await import('../src/app/api/auth/login/route');
    const body = {
      authenticationResponse: { id: 'cred-123', rawId: 'cred-123', response: {}, clientExtensionResults: {}, type: 'public-key' },
      expectedChallenge: 'test-challenge',
    };
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    const setCookie = res.headers.get('set-cookie') ?? '';
    // In production, cookie name should be __Host-verbalibera_session
    expect(setCookie).toMatch(/__Host-verbalibera_session/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = prev;
  });
});
