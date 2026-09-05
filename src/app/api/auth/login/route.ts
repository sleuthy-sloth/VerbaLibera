import 'server-only';

import { NextResponse } from 'next/server';

import { challengeOptions, consumeChallenge, CHALLENGE_COOKIE } from '@/lib/auth/challenge';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, issueSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { CSRF_COOKIE_NAME, csrfCookieOptions, generateCsrfToken } from '@/lib/auth/csrf';
import { verifyAuthentication } from '@/lib/auth/webauthn';
import { withObserve } from '@/lib/observe';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
const MAX_BODY_BYTES = 8192;

async function boundedJsonBody(request: Request): Promise<
  | { status: 'ready'; body: unknown }
  | { status: 'too_large' }
  | { status: 'invalid_request' }
> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
    return { status: 'too_large' };
  }
  const body = request.body;
  if (!body) return { status: 'ready', body: null };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel('oversized');
        return { status: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { status: 'invalid_request' };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) return { status: 'ready', body: null };
  try {
    return { status: 'ready', body: JSON.parse(text) };
  } catch {
    return { status: 'invalid_request' };
  }
}

async function postHandler(request: Request) {
  const bounded = await boundedJsonBody(request);
  if (bounded.status === 'too_large') {
    return NextResponse.json({ status: 'request_too_large' }, { status: 413, headers: NO_STORE_HEADERS });
  }
  if (bounded.status === 'invalid_request') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const body = bounded.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const authenticationResponse = (body as { authenticationResponse?: unknown }).authenticationResponse;
  const challenge = await consumeChallenge(request, 'login');
  const expectedChallenge = challenge?.challenge;

  if (!authenticationResponse || typeof authenticationResponse !== 'object') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (typeof expectedChallenge !== 'string' || !expectedChallenge.trim()) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Extract credentialId from response to lookup
  const responseId = (authenticationResponse as { id?: unknown }).id;
  if (typeof responseId !== 'string' || !responseId.trim()) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const credential = await prisma.credential.findUnique({
      where: { credentialId: responseId },
    });

    if (!credential) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
    }

    // Prisma Bytes may be Buffer
    const publicKeyU8 = Buffer.isBuffer(credential.publicKey)
      ? new Uint8Array(credential.publicKey as unknown as Buffer)
      : (credential.publicKey as unknown as Uint8Array);

    const transports = credential.transports ? (credential.transports.split(',') as never[]) : undefined;

    const verification = await verifyAuthentication({
      response: authenticationResponse as never,
      expectedChallenge,
      credential: {
        credentialId: credential.credentialId,
        publicKey: publicKeyU8,
        counter: Number(credential.counter),
        transports,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
    }

    // Update counter for clone detection
    await prisma.credential.update({
      where: { credentialId: credential.credentialId },
      data: { counter: BigInt(verification.newCounter) },
    });

    const token = await issueSessionToken(credential.userId);
    const csrfToken = generateCsrfToken();
    const response = NextResponse.json({ status: 'ok', userId: credential.userId }, { status: 200, headers: NO_STORE_HEADERS });
    response.cookies.set(getSessionCookieName(), token, sessionCookieOptions() as never);
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions() as never);
    response.cookies.set(CHALLENGE_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}

export const POST = withObserve('/api/auth/login', postHandler);

export const GET = (request: Request) => challengeOptions(request, 'login');
