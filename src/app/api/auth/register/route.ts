import 'server-only';

import { NextResponse } from 'next/server';

import { challengeOptions, consumeChallengeById, readChallenge, CHALLENGE_COOKIE } from '@/lib/auth/challenge';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, issueSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { CSRF_COOKIE_NAME, csrfCookieOptions, generateCsrfToken } from '@/lib/auth/csrf';
import { verifyRegistration } from '@/lib/auth/webauthn';
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

function isRegistrationAllowed(request: Request, bodyToken?: unknown): boolean {
  const required = process.env.REGISTRATION_TOKEN;
  if (!required) return true;
  const headerToken = request.headers.get('x-registration-token')?.trim();
  if (headerToken && headerToken === required) return true;
  if (typeof bodyToken === 'string' && bodyToken === required) return true;
  return false;
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

  const registrationToken = (body as { registrationToken?: unknown }).registrationToken;
  if (!isRegistrationAllowed(request, registrationToken)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const accountIdentifier = (body as { accountIdentifier?: unknown }).accountIdentifier;
  const attestationResponse = (body as { attestationResponse?: unknown }).attestationResponse;
  const challenge = await readChallenge(request, 'register');
  const expectedChallenge = challenge?.challenge;

  if (typeof accountIdentifier !== 'string' || !accountIdentifier.trim() || accountIdentifier.trim() !== challenge?.accountIdentifier) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!attestationResponse || typeof attestationResponse !== 'object') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (!challenge || typeof expectedChallenge !== 'string' || !expectedChallenge.trim()) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const verification = await verifyRegistration({
      response: attestationResponse as never,
      expectedChallenge,
    });

    if (!verification.verified || !verification.credential) {
      return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    // Consume only after WebAuthn verification succeeds. This lets a user
    // retry a response after a transient browser or hostname mismatch.
    if (!await consumeChallengeById(challenge.id, 'register', challenge.expiresAt)) {
      return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const { credentialId, publicKey, counter, transports } = verification.credential;

    // A new passkey cannot be attached to an existing account by name.
    // The unique identifier and nested write make registration atomic.
    const user = await prisma.user.create({
      data: {
        accountIdentifier: accountIdentifier.trim(),
        credentials: { create: { credentialId, publicKey: Buffer.from(publicKey), counter: BigInt(counter), transports: transports ? transports.join(',') : null } },
      },
    });

    const token = await issueSessionToken(user.id);
    const csrfToken = generateCsrfToken();
    const response = NextResponse.json({ status: 'ok', userId: user.id }, { status: 200, headers: NO_STORE_HEADERS });
    response.cookies.set(getSessionCookieName(), token, sessionCookieOptions() as never);
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions() as never);
    response.cookies.set(CHALLENGE_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ status: 'account_exists' }, { status: 409, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}

export const POST = withObserve('/api/auth/register', postHandler);

export const GET = (request: Request) => challengeOptions(request, 'register');
