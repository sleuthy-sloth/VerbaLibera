import { indexedDB } from 'fake-indexeddb';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFoundationProgress } from '@/features/progress/use-foundation-progress';
import { makePilotPack } from './fixtures/lesson-variety';

/**
 * The one part of the Today card that comes off the device.
 *
 * Its whole contract is that a card is never shown a history it cannot trust:
 * the read either lands, or it reports `unavailable` so the snapshot decides.
 * These cases pin the two ways it can fail and the one way it can go stale.
 */

const PACK = makePilotPack();
const LESSONS = (PACK.lessons as unknown[]).length;

function servePacks(ok = true) {
  return vi.fn(async (url: string) => {
    if (!ok) return new Response(null, { status: 500 });
    if (String(url).includes('/packs/')) {
      return new Response(JSON.stringify(PACK), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', indexedDB);
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useFoundationProgress', () => {
  it('reports a practice history it can read', async () => {
    vi.stubGlobal('fetch', servePacks());
    const { result } = renderHook(() => useFoundationProgress({ language: 'italian' }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('unreachable');
    // Nothing practised yet is a real answer, not an error: the pack is known,
    // so "situations 0 of 3" is something the card can say honestly.
    expect(result.current.foundation.hasPractice).toBe(false);
    expect(result.current.foundation.language).toBe('italian');
    expect(result.current.summary.situationsTotal).toBe(LESSONS);
    expect(result.current.summary.phrasesPractised).toBe(0);
  });

  it('says unavailable rather than empty when the pack will not load', async () => {
    // Break caught: a failed read is rendered as "nothing practised yet", which
    // tells a learner their history is gone and hides the snapshot's answer.
    vi.stubGlobal('fetch', servePacks(false));
    const { result } = renderHook(() => useFoundationProgress({ language: 'italian' }));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });

  it('does not hand the previous course to a learner who just switched', async () => {
    // Break caught: switching language keeps the old course's action on screen,
    // so the link under "Review 4 phrases" points at the course they left.
    vi.stubGlobal('fetch', servePacks());
    const { result, rerender } = renderHook(
      ({ language }: { language: string }) => useFoundationProgress({ language }),
      { initialProps: { language: 'italian' } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ language: 'french' });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') throw new Error('unreachable');
    expect(result.current.foundation.language).toBe('french');
  });

  it('has nothing to read without a course', async () => {
    vi.stubGlobal('fetch', servePacks());
    const { result } = renderHook(() => useFoundationProgress({ language: null }));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });
});
