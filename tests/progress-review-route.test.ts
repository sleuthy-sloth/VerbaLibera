import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST as reviewPOST } from '../src/app/api/progress/review/route';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    drillItem: { findUnique: vi.fn() },
    userProgress: { findUnique: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    reviewLog: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb({
      userProgress: { upsert: vi.fn().mockResolvedValue({}) },
      reviewLog: { create: vi.fn().mockResolvedValue({ nextReviewAt: new Date().toISOString(), intervalDays: 1 }) },
    })),
  },
}));

// Mock session
vi.mock('@/lib/auth/session', () => ({
  verifySessionToken: vi.fn(),
  SESSION_COOKIE_NAME: 'verbalibera_session',
}));

// Mock csrf
vi.mock('@/lib/auth/csrf', () => ({
  validateCsrfRequest: vi.fn(() => true),
}));

// Mock scheduler
vi.mock('@/features/srs/scheduler', () => ({
  scheduleReview: vi.fn(() => ({
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 1,
    dueAt: new Date(Date.now() + 86400000),
    lapseCount: 0,
    lastReviewedAt: new Date(),
    lastQuality: 5,
    lastLatencyMs: 1000,
  })),
}));

import { prisma } from '@/lib/prisma';
import { verifySessionToken } from '@/lib/auth/session';

describe('POST /api/progress/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifySessionToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-123' });
    (prisma.drillItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'drill-123' });
    (prisma.reviewLog.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.userProgress.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  function makeRequest(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/progress/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: 'verbalibera_session=valid-token', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('rejects unauthenticated', async () => {
    (verifySessionToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await reviewPOST(makeRequest({ drillItemId: 'drill-123', verdict: 'exact', latencyMs: 1000 }));
    expect(res.status).toBe(401);
  });

  it('rejects oversized body (>1KB)', async () => {
    const big = 'x'.repeat(2000);
    const req = new Request('http://localhost/api/progress/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: 'verbalibera_session=valid-token', 'content-length': '2000' },
      body: JSON.stringify({ drillItemId: big, verdict: 'exact' }),
    });
    const res = await reviewPOST(req);
    expect(res.status).toBe(413);
  });

  it('accepts valid review and returns nextReviewAt', async () => {
    const res = await reviewPOST(makeRequest({ drillItemId: 'drill-123', verdict: 'exact', latencyMs: 1200, clientMutationId: 'mut-1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.nextReviewAt).toBeDefined();
  });

  it('handles idempotency via clientMutationId', async () => {
    const existing = { nextReviewAt: new Date().toISOString(), intervalDays: 2 };
    (prisma.reviewLog.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
    const res = await reviewPOST(makeRequest({ drillItemId: 'drill-123', verdict: 'exact', clientMutationId: 'mut-1' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.intervalDays).toBe(2);
  });
});


it('accepts the production host cookie for a saved review', async () => {
  vi.mocked(verifySessionToken).mockResolvedValue({ userId: 'user-123' });
  vi.mocked(prisma.drillItem.findUnique).mockResolvedValue({ id: 'drill-123' } as never);
  vi.mocked(prisma.reviewLog.findUnique).mockResolvedValue(null);
  const response = await reviewPOST(new Request('https://verbalibera.vercel.app/api/progress/review', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: '__Host-verbalibera_session=valid-token' },
    body: JSON.stringify({ drillItemId: 'drill-123', verdict: 'exact' }),
  }));
  expect(response.status).toBe(200);
});
