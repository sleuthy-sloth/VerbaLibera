import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionCookieName, SESSION_COOKIE_BASE_NAME, SESSION_HOST_COOKIE_NAME } from '@/lib/auth/session';
import { CSRF_COOKIE_NAME, csrfCookieOptions, generateCsrfToken } from '@/lib/auth/csrf';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/learn',
  '/api/answer-check',
  '/api/demo/progress',
  '/api/auth/register',
  '/api/auth/login',
  '/api/voice/transcribe',
  '/api/voice/health',
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  // Exact public paths or prefix
  for (const pub of PUBLIC_PATHS) {
    if (pathname === pub) return true;
    if (pub !== '/' && pathname.startsWith(pub + '/')) return true;
    // For /learn, allow /learn/* without needing to list
    if (pub === '/learn' && pathname.startsWith('/learn/')) return true;
  }
  // Allow Next internals and static
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon.ico') || pathname.startsWith('/public/')) {
    return true;
  }
  // Allow GET to public API? But proxy should allow all public listed
  if (pathname.startsWith('/api/answer-check') || pathname.startsWith('/api/demo/')) return true;
  return false;
}

export function isProtectedMutation(pathname: string, method: string): boolean {
  const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  if (!isMutation) return false;
  if (pathname.startsWith('/api/progress/')) return true;
  if (pathname.startsWith('/account')) return true;
  if (pathname.startsWith('/settings')) return true;
  return false;
}

function getSessionTokenFromRequest(request: NextRequest): string | undefined {
  // Support both legacy and __Host- cookie names for smooth production transition
  return (
    request.cookies.get(SESSION_HOST_COOKIE_NAME)?.value ??
    request.cookies.get(SESSION_COOKIE_BASE_NAME)?.value ??
    request.cookies.get(getSessionCookieName())?.value
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Always ensure CSRF cookie is set for browser requests
  const hasCsrfCookie = request.cookies.has(CSRF_COOKIE_NAME);
  const responseNext = NextResponse.next();

  if (!hasCsrfCookie && (method === 'GET' || method === 'HEAD')) {
    const token = generateCsrfToken();
    responseNext.cookies.set(CSRF_COOKIE_NAME, token, csrfCookieOptions() as never);
  }

  // Public paths are always allowed
  if (isPublicPath(pathname)) {
    // For public GET, we already set CSRF if needed, return
    if (isPublicPath(pathname)) {
      // If we set CSRF, return that response, else next
      return hasCsrfCookie ? NextResponse.next() : responseNext;
    }
  }

  // Protected mutations: require valid session (cookie presence; full verify in route handler)
  if (isProtectedMutation(pathname, method)) {
    const token = getSessionTokenFromRequest(request);
    if (!token) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return hasCsrfCookie ? NextResponse.next() : responseNext;
  }

  // For all other protected pages (e.g. /account/*), require session cookie presence
  const isProtectedPage = pathname.startsWith('/account') || pathname.startsWith('/settings') || pathname.startsWith('/api/progress');
  if (isProtectedPage) {
    const token = getSessionTokenFromRequest(request);
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return hasCsrfCookie ? NextResponse.next() : responseNext;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
