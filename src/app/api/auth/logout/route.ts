import 'server-only';

import { NextResponse } from 'next/server';

import { SESSION_COOKIE_BASE_NAME, SESSION_HOST_COOKIE_NAME, clearSessionCookieOptions, getSessionCookieName } from '@/lib/auth/session';
import { validateCsrfRequest } from '@/lib/auth/csrf';
import { withObserve } from '@/lib/observe';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

async function postHandler(request: Request) {
  // Enforce double-submit CSRF for authenticated logout
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (cookieHeader.includes('verbalibera_csrf') && !validateCsrfRequest(request)) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 403, headers: NO_STORE_HEADERS });
  }
  const response = NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
  // Clear both legacy and Host-prefixed cookies to handle env transitions
  response.cookies.set(SESSION_COOKIE_BASE_NAME, '', clearSessionCookieOptions() as never);
  response.cookies.set(SESSION_HOST_COOKIE_NAME, '', clearSessionCookieOptions() as never);
  response.cookies.set(getSessionCookieName(), '', clearSessionCookieOptions() as never);
  return response;
}

export const POST = withObserve('/api/auth/logout', postHandler);
