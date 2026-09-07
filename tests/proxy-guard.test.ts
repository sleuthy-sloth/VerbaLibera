import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import proxy, { isPublicPath, isProtectedMutation } from '../proxy';

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
      expect(getName()).toBe('__Host-verbalibera_session');
    } else {
      // Before implementation, SESSION_COOKIE_NAME is still legacy, so this fails
      expect((sessionMod as unknown as { SESSION_COOKIE_NAME: string }).SESSION_COOKIE_NAME).toBe('__Host-verbalibera_session');
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

  describe('desktop surfaces', () => {
    const savedMode = process.env.VERBALIBERA_DESKTOP_MODE;
    beforeEach(() => {
      delete process.env.VERBALIBERA_DESKTOP_MODE;
    });
    afterEach(() => {
      if (savedMode === undefined) delete process.env.VERBALIBERA_DESKTOP_MODE;
      else process.env.VERBALIBERA_DESKTOP_MODE = savedMode;
    });

    it('returns 404 for desktop APIs outside local desktop mode', async () => {
      const response = await proxy(
        new NextRequest('http://localhost/api/desktop/health'),
      );
      expect(response.status).toBe(404);
    });

    it('redirects desktop pages outside local desktop mode', async () => {
      const response = await proxy(
        new NextRequest('http://localhost/desktop/profiles'),
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/');
    });

    it('passes desktop surfaces through in local desktop mode', async () => {
      process.env.VERBALIBERA_DESKTOP_MODE = 'local';
      const api = await proxy(
        new NextRequest('http://localhost/api/desktop/health'),
      );
      expect(api.status).toBe(200);
      const page = await proxy(
        new NextRequest('http://localhost/desktop/profiles'),
      );
      expect(page.status).toBe(200);
    });
  });
});
