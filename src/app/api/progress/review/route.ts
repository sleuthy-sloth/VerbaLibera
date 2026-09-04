import 'server-only';

import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import { validateCsrfRequest } from '@/lib/auth/csrf';
import { qualityFromVerdict } from '@/lib/progress/quality';
import { scheduleReview } from '@/features/srs/scheduler';
import type { ReviewQuality } from '@/features/srs/scheduler';
import { withObserve } from '@/lib/observe';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
const MAX_BODY_BYTES = 1024;

async function boundedJsonBody(request: Request): Promise<
  | { status: 'ready'; body: unknown }
  | { status: 'too_large' }
  | { status: 'invalid_request' }
> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_BODY_BYTES) {
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
  // CSRF check for authenticated mutation
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (cookieHeader.includes('verbalibera_csrf') && !validateCsrfRequest(request)) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 403, headers: NO_STORE_HEADERS });
  }

  // Auth guard
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.split(';').find((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
  const token = match ? decodeURIComponent(match.split('=')[1] ?? '') : null;
  if (!token) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
  }
  const userId = session.userId;

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

  const drillItemId = (body as { drillItemId?: unknown }).drillItemId;
  const verdict = (body as { verdict?: unknown }).verdict;
  const latencyMs = (body as { latencyMs?: unknown }).latencyMs;
  const clientMutationId = (body as { clientMutationId?: unknown }).clientMutationId;

  if (typeof drillItemId !== 'string' || !drillItemId.trim()) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (verdict !== 'exact' && verdict !== 'close' && verdict !== 'try_again') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (latencyMs !== undefined && latencyMs !== null && (typeof latencyMs !== 'number' || !Number.isFinite(latencyMs) || latencyMs < 0)) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }
  if (clientMutationId !== undefined && clientMutationId !== null && typeof clientMutationId !== 'string') {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Validate drill exists
  const drill = await prisma.drillItem.findUnique({ where: { id: drillItemId } });
  if (!drill) {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Idempotency: if clientMutationId provided and ReviewLog exists, return cached
  if (typeof clientMutationId === 'string' && clientMutationId.trim()) {
    const existing = await prisma.reviewLog.findUnique({
      where: {
        userId_drillItemId_clientMutationId: {
          userId,
          drillItemId,
          clientMutationId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { status: 'ok', nextReviewAt: existing.nextReviewAt, intervalDays: existing.intervalDays },
        { status: 200, headers: NO_STORE_HEADERS },
      );
    }
  }

  // Compute quality via pure mapping
  let quality: ReviewQuality;
  try {
    quality = qualityFromVerdict(verdict as never, (latencyMs as number | null) ?? null) as ReviewQuality;
  } catch {
    return NextResponse.json({ status: 'invalid_request' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const now = new Date();

  // Fetch or create UserProgress
  const existingProgress = await prisma.userProgress.findUnique({
    where: { userId_drillItemId: { userId, drillItemId } },
  });

  const previousState = existingProgress
    ? {
        easeFactor: existingProgress.easeFactor,
        intervalDays: existingProgress.intervalDays,
        repetitions: existingProgress.repetitions,
        dueAt: existingProgress.dueAt,
        lapseCount: existingProgress.lapseCount,
        lastReviewedAt: existingProgress.lastReviewedAt ?? now,
        lastQuality: (existingProgress.lastQuality as ReviewQuality) ?? 0,
        lastLatencyMs: existingProgress.lastLatencyMs,
      }
    : {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: now,
        lapseCount: 0,
        lastReviewedAt: now,
        lastQuality: 0 as ReviewQuality,
        lastLatencyMs: null,
      };

  const nextState = scheduleReview(previousState as never, quality, now);

  // Transaction: upsert UserProgress and insert ReviewLog
  const result = await prisma.$transaction(async (tx) => {
    const progress = await tx.userProgress.upsert({
      where: { userId_drillItemId: { userId, drillItemId } },
      update: {
        easeFactor: nextState.easeFactor,
        intervalDays: nextState.intervalDays,
        repetitions: nextState.repetitions,
        dueAt: nextState.dueAt,
        lapseCount: nextState.lapseCount,
        lastReviewedAt: nextState.lastReviewedAt,
        lastQuality: nextState.lastQuality,
        lastLatencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      },
      create: {
        userId,
        drillItemId,
        easeFactor: nextState.easeFactor,
        intervalDays: nextState.intervalDays,
        repetitions: nextState.repetitions,
        dueAt: nextState.dueAt,
        lapseCount: nextState.lapseCount,
        lastReviewedAt: nextState.lastReviewedAt,
        lastQuality: nextState.lastQuality,
        lastLatencyMs: typeof latencyMs === 'number' ? latencyMs : null,
      },
    });

    const reviewLog = await tx.reviewLog.create({
      data: {
        userId,
        drillItemId,
        clientMutationId: typeof clientMutationId === 'string' ? clientMutationId : null,
        quality,
        latencyMs: typeof latencyMs === 'number' ? latencyMs : null,
        intervalDays: nextState.intervalDays,
        nextReviewAt: nextState.dueAt,
      },
    });

    return { progress, reviewLog };
  });

  return NextResponse.json(
    { status: 'ok', nextReviewAt: result.reviewLog.nextReviewAt, intervalDays: result.reviewLog.intervalDays },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export const POST = withObserve('/api/progress/review', postHandler);
