import 'server-only';

import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME, clearSessionCookieOptions } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export async function POST() {
  const response = NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE_HEADERS });
  response.cookies.set(SESSION_COOKIE_NAME, '', clearSessionCookieOptions());
  return response;
}
