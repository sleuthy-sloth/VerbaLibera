import 'server-only';

import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME, clearSessionCookieOptions } from '@/lib/auth/session';
import { validateCsrfRequest } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: Request) {
  // Enforce double-submit CSRF for authenticated logout
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (cookieHeader.includes('voxlibre_csrf') && !validateCsrfRequest(request)) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 403, headers: NO_STORE_HEADERS });
  }
  const response = NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
  response.cookies.set(SESSION_COOKIE_NAME, '', clearSessionCookieOptions());
  return response;
}
