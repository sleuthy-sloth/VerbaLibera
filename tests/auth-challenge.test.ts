import { describe, it, expect, vi } from 'vitest';
import { consumeChallenge } from '@/lib/auth/challenge';
vi.mock('@/lib/prisma', () => ({ prisma: { authChallenge: { findUnique: vi.fn(), deleteMany: vi.fn() } } }));
import { prisma } from '@/lib/prisma';

describe('server-issued authentication challenges', () => {
  it('rejects requests without a challenge cookie', async () => {
    expect(await consumeChallenge(new Request('https://example.com'), 'login')).toBeNull();
  });
  it('rejects expired challenges and challenges for another operation', async () => {
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue({ id: 'nonce', purpose: 'register', expiresAt: new Date(0) } as never);
    expect(await consumeChallenge(new Request('https://example.com', { headers: { cookie: 'verbalibera_challenge=nonce' } }), 'login')).toBeNull();
  });
  it('returns a challenge once and rejects a replay', async () => {
    const stored = { id: 'nonce', purpose: 'login', challenge: 'server-random', accountIdentifier: null, expiresAt: new Date(Date.now() + 60000) };
    vi.mocked(prisma.authChallenge.findUnique).mockResolvedValue(stored);
    vi.mocked(prisma.authChallenge.deleteMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const request = new Request('https://example.com', { headers: { cookie: 'verbalibera_challenge=nonce' } });
    expect(await consumeChallenge(request, 'login')).toEqual(stored);
    expect(await consumeChallenge(request, 'login')).toBeNull();
  });
});
