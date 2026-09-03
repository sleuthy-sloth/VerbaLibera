import { describe, it, expect } from 'vitest';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, generateCsrfToken, validateCsrfRequest } from '../src/lib/auth/csrf';

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
});
