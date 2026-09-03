import { describe, it, expect } from 'vitest';

import { isPublicPath, isProtectedMutation } from '../proxy';

describe('proxy guard', () => {
  it('allows public paths', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/learn')).toBe(true);
    expect(isPublicPath('/learn/fr')).toBe(true);
    expect(isPublicPath('/api/answer-check')).toBe(true);
    expect(isPublicPath('/api/demo/progress')).toBe(true);
    expect(isPublicPath('/api/auth/register')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
  });

  it('marks protected mutations', () => {
    expect(isProtectedMutation('/api/progress/review', 'POST')).toBe(true);
    expect(isProtectedMutation('/api/progress/review', 'GET')).toBe(false);
    expect(isProtectedMutation('/account', 'POST')).toBe(true);
    expect(isProtectedMutation('/account', 'GET')).toBe(false);
    expect(isProtectedMutation('/', 'POST')).toBe(false);
    expect(isProtectedMutation('/api/answer-check', 'POST')).toBe(false);
  });

  it('treats unknown api as not protected (except progress)', () => {
    expect(isProtectedMutation('/api/other', 'POST')).toBe(false);
    expect(isProtectedMutation('/api/demo/progress', 'POST')).toBe(false);
  });

  it('proxy handles __Host- session cookie for protected mutations (production)', async () => {
    const prev = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'production';
    const sessionMod = await import('../src/lib/auth/session');
    const getName = (sessionMod as unknown as { getSessionCookieName?: () => string }).getSessionCookieName;
    if (typeof getName === 'function') {
      expect(getName()).toBe('__Host-voxlibre_session');
    } else {
      // Before implementation, SESSION_COOKIE_NAME is still legacy, so this fails
      expect((sessionMod as unknown as { SESSION_COOKIE_NAME: string }).SESSION_COOKIE_NAME).toBe('__Host-voxlibre_session');
    }
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = prev;
  });

  it('expects session cookie options to be Secure/HttpOnly/SameSite=Lax in production', async () => {
    const prev = process.env.NODE_ENV;
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = 'production';
    const { sessionCookieOptions } = await import('../src/lib/auth/session');
    const opts = sessionCookieOptions();
    expect(opts.secure).toBe(true);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    (process.env as unknown as { NODE_ENV: string }).NODE_ENV = prev;
  });
});
