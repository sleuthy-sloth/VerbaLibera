import { NextResponse } from 'next/server';

import { demoProgress } from '@/features/progress/demo-progress';
import { getProgressSnapshot } from '@/lib/progress/snapshot';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';

export async function GET(request?: Request) {
  const req = request ?? new Request('http://localhost/api/demo/progress');
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  let token: string | null = null;
  for (const cookie of cookies) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      token = decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1));
      break;
    }
  }

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      const snapshot = await getProgressSnapshot(session.userId);
      return NextResponse.json(snapshot, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }

  return NextResponse.json(demoProgress, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
