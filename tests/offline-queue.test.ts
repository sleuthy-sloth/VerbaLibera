import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { demoProgress } from '@/features/progress/demo-progress';
import { useReviewMutation } from '@/features/progress/use-review-mutation';
import {
  enqueueReview,
  getQueuedReviews,
  dequeueReview,
  clearQueuedReviews,
  replayQueuedReviews,
  REVIEW_QUEUE_STORE,
  DB_NAME,
  LS_KEY,
} from '@/lib/progress/offline-queue';

// Ensure jsdom has a working localStorage even when Vitest's jsdom url is opaque or --localstorage-file misconfigured.
// We provide a Map-backed mock that satisfies Storage interface.
function ensureMockLocalStorage() {
  const createMock = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      get length() {
        return store.size;
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
    } as unknown as Storage;
  };

  const needsMock = (() => {
    try {
      const ls = (window as unknown as { localStorage?: Storage }).localStorage;
      return !ls || typeof ls.clear !== 'function' || typeof ls.getItem !== 'function';
    } catch {
      return true;
    }
  })();

  if (needsMock) {
    const mock = createMock();
    try {
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true, writable: true });
    } catch {}
    try {
      Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
    } catch {}
  }
}

ensureMockLocalStorage();

function safeClearLS() {
  try {
    window.localStorage?.clear?.();
  } catch {}
  try {
    (globalThis as unknown as { localStorage?: Storage }).localStorage?.clear?.();
  } catch {}
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Harness({ client }: { client: QueryClient }) {
  const mutation = useReviewMutation();
  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () =>
          mutation.mutate({
            drillItemId: 'fr-ordering-politely-drill',
            verdict: 'exact',
            latencyMs: 1200,
            clientMutationId: 'offline-mut-1',
          }),
      },
      'review',
    ),
    React.createElement('span', { 'data-testid': 'pending' }, String(mutation.isPending)),
  );
}

function NoIdHarness() {
  const m = useReviewMutation();
  return React.createElement(
    'button',
    {
      type: 'button',
      onClick: () =>
        m.mutate({
          drillItemId: 'no-id-drill',
          verdict: 'close',
          latencyMs: null,
        }),
    },
    'no-id',
  );
}

describe('offline-queue', () => {
  beforeEach(async () => {
    safeClearLS();
    await clearQueuedReviews();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    ensureMockLocalStorage();
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(async () => {
    await clearQueuedReviews();
    safeClearLS();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
    document.querySelectorAll('[data-testid="offline-queue-toast"]').forEach((el) => el.remove());
    document.querySelectorAll('[role="status"]').forEach((el) => {
      if (el.textContent?.includes('Will sync')) el.remove();
    });
    ensureMockLocalStorage();
  });

  it('exposes reviewQueue store constants for IndexedDB', async () => {
    expect(REVIEW_QUEUE_STORE).toBe('reviewQueue');
    expect(DB_NAME).toBe('verbalibera-offline');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/progress/offline-queue.ts'), 'utf8');
    expect(src).toMatch(/reviewQueue/);
    expect(src).toMatch(/indexedDB/);
    expect(src).toMatch(/localStorage/);
    expect(src).toMatch(/enqueue/);
    expect(src).toMatch(/dequeue/);
    expect(src).toMatch(/replay/);
    expect(src).toMatch(/clientMutationId/);
  });

  it('fake offline POST review creates reviewQueue entry', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });
    const entry = await enqueueReview({
      drillItemId: 'fr-ordering-politely-drill',
      verdict: 'exact',
      latencyMs: 1200,
      clientMutationId: 'offline-mut-1',
    });
    expect(entry.clientMutationId).toBe('offline-mut-1');
    expect(entry.drillItemId).toBe('fr-ordering-politely-drill');
    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.clientMutationId).toBe('offline-mut-1');
    expect(queued[0]?.verdict).toBe('exact');
  });

  it('goes online and replays queue, ReviewLog created once even on retry (idempotent via clientMutationId)', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });
    await enqueueReview({
      drillItemId: 'fr-ordering-politely-drill',
      verdict: 'exact',
      latencyMs: 1200,
      clientMutationId: 'offline-mut-1',
    });
    expect(await getQueuedReviews()).toHaveLength(1);

    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'ok', nextReviewAt: new Date().toISOString(), intervalDays: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result1 = await replayQueuedReviews();
    expect(result1.succeeded).toBe(1);
    expect(result1.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledBody = JSON.parse(
      ((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]?.body as string) ?? '{}',
    );
    expect(calledBody.clientMutationId).toBe('offline-mut-1');
    expect(calledBody.drillItemId).toBe('fr-ordering-politely-drill');
    expect(await getQueuedReviews()).toHaveLength(0);

    const result2 = await replayQueuedReviews();
    expect(result2.succeeded).toBe(0);
    expect(result2.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await enqueueReview({
      drillItemId: 'fr-ordering-politely-drill',
      verdict: 'exact',
      latencyMs: 1200,
      clientMutationId: 'offline-mut-1',
    });
    await enqueueReview({
      drillItemId: 'fr-ordering-politely-drill',
      verdict: 'exact',
      latencyMs: 1200,
      clientMutationId: 'offline-mut-1',
    });
    const afterDedupe = await getQueuedReviews();
    expect(afterDedupe).toHaveLength(1);

    const result3 = await replayQueuedReviews();
    expect(result3.succeeded).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await getQueuedReviews()).toHaveLength(0);
  });

  it('handles replay idempotency when server returns cached 200 for duplicate clientMutationId', async () => {
    await enqueueReview({
      drillItemId: 'drill-xyz',
      verdict: 'close',
      latencyMs: 800,
      clientMutationId: 'dup-mut-42',
    });
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      return new Response(JSON.stringify({ status: 'ok', nextReviewAt: new Date().toISOString(), intervalDays: 2 }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const r1 = await replayQueuedReviews();
    expect(r1.succeeded).toBe(1);
    expect(callCount).toBe(1);
    expect(await getQueuedReviews()).toHaveLength(0);
    await enqueueReview({
      drillItemId: 'drill-xyz',
      verdict: 'close',
      latencyMs: 800,
      clientMutationId: 'dup-mut-42',
    });
    const r2 = await replayQueuedReviews();
    expect(r2.succeeded).toBe(1);
    expect(callCount).toBe(2);
    expect(await getQueuedReviews()).toHaveLength(0);
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    const originalIDB = (globalThis as unknown as { indexedDB?: unknown }).indexedDB;
    vi.stubGlobal('indexedDB', undefined);
    await clearQueuedReviews();
    safeClearLS();
    ensureMockLocalStorage();
    const entry = await enqueueReview({
      drillItemId: 'fallback-drill',
      verdict: 'try_again',
      latencyMs: null,
      clientMutationId: 'fallback-mut-1',
    });
    expect(entry.clientMutationId).toBe('fallback-mut-1');
    const raw = window.localStorage.getItem(LS_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].clientMutationId).toBe('fallback-mut-1');
    const queued = await getQueuedReviews();
    expect(queued).toHaveLength(1);
    await dequeueReview('fallback-mut-1');
    expect(await getQueuedReviews()).toHaveLength(0);
    expect(window.localStorage.getItem(LS_KEY)).toBe('[]');
    if (originalIDB) vi.stubGlobal('indexedDB', originalIDB as unknown as typeof indexedDB);
    else vi.unstubAllGlobals();
  });

  it('dequeues specific entry and clears all', async () => {
    await enqueueReview({
      drillItemId: 'drill-a',
      verdict: 'exact',
      clientMutationId: 'mut-a',
    });
    await enqueueReview({
      drillItemId: 'drill-b',
      verdict: 'close',
      clientMutationId: 'mut-b',
    });
    expect(await getQueuedReviews()).toHaveLength(2);
    await dequeueReview('mut-a');
    const afterOne = await getQueuedReviews();
    expect(afterOne).toHaveLength(1);
    expect(afterOne[0]?.clientMutationId).toBe('mut-b');
    await clearQueuedReviews();
    expect(await getQueuedReviews()).toHaveLength(0);
  });

  it('replay keeps failed entries for retry on network error', async () => {
    await enqueueReview({
      drillItemId: 'drill-fail',
      verdict: 'exact',
      clientMutationId: 'mut-fail-1',
    });
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const result = await replayQueuedReviews();
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(await getQueuedReviews()).toHaveLength(1);
    const successMock = vi.fn(
      async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', successMock as unknown as typeof fetch);
    const result2 = await replayQueuedReviews();
    expect(result2.succeeded).toBe(1);
    expect(await getQueuedReviews()).toHaveLength(0);
  });
});

describe('useReviewMutation offline', () => {
  beforeEach(async () => {
    safeClearLS();
    await clearQueuedReviews();
    vi.restoreAllMocks();
    ensureMockLocalStorage();
    document.querySelectorAll('[data-testid="offline-queue-toast"]').forEach((el) => el.remove());
  });

  afterEach(async () => {
    await clearQueuedReviews();
    safeClearLS();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
    document.querySelectorAll('[data-testid="offline-queue-toast"]').forEach((el) => el.remove());
    ensureMockLocalStorage();
  });

  it('enqueues when navigator.onLine===false and shows toast "Will sync when you\'re back online"', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const client = createQueryClient();
    client.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });
    client.setQueryData(['demo-progress'], { ...demoProgress, dueReviewCount: 6 });
    render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(Harness, { client }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'review' }));
    await waitFor(() => {
      const data = client.getQueryData<typeof demoProgress>(['demo', 'progress']);
      expect(data?.dueReviewCount).toBe(5);
    });
    await waitFor(async () => {
      const queued = await getQueuedReviews();
      expect(queued).toHaveLength(1);
      expect(queued[0]?.clientMutationId).toBe('offline-mut-1');
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => {
      const toast = document.querySelector('[role="status"]') ?? screen.queryByRole('status');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toMatch(/Will sync when you're back online/i);
    });
    const fs = await import('node:fs');
    const path = await import('node:path');
    const hookSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/progress/use-review-mutation.ts'), 'utf8');
    expect(hookSrc).toMatch(/navigator\.onLine/);
    expect(hookSrc).toMatch(/enqueue/);
    expect(hookSrc).toMatch(/Will sync when you're back online/);
    expect(hookSrc).toMatch(/online/);
  });

  it('syncs on reconnect (online event) and invalidates queries', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ status: 'ok', nextReviewAt: new Date().toISOString(), intervalDays: 1 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });
    await enqueueReview({
      drillItemId: 'fr-ordering-politely-drill',
      verdict: 'exact',
      latencyMs: 500,
      clientMutationId: 'reconnect-mut-1',
    });
    expect(await getQueuedReviews()).toHaveLength(1);
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
    const client = createQueryClient();
    client.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(Harness, { client }),
      ),
    );
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(async () => {
      const queued = await getQueuedReviews();
      expect(queued).toHaveLength(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      ((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]?.body as string) ?? '{}',
    );
    expect(body.clientMutationId).toBe('reconnect-mut-1');
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not call fetch when offline even if clientMutationId missing (generates one)', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    const client = createQueryClient();
    client.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });
    render(
      React.createElement(QueryClientProvider, { client }, React.createElement(NoIdHarness, null)),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'no-id' }));
    await waitFor(async () => {
      const q = await getQueuedReviews();
      expect(q).toHaveLength(1);
      expect(q[0]?.clientMutationId).toBeTruthy();
      expect(q[0]?.drillItemId).toBe('no-id-drill');
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});


describe('offline review account isolation', () => {
  it('does not replay reviews after the signed-in session changes', async () => {
    await clearQueuedReviews();
    document.cookie = 'verbalibera_csrf=first-session; path=/';
    await enqueueReview({ drillItemId: 'fr-ordering-politely-drill', verdict: 'exact' });
    document.cookie = 'verbalibera_csrf=other-session; path=/';
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    try {
      expect(await replayQueuedReviews({ fetchFn })).toEqual({ succeeded: 0, failed: 1 });
      expect(fetchFn).not.toHaveBeenCalled();
    } finally {
      document.cookie = 'verbalibera_csrf=; Max-Age=0; path=/';
      await clearQueuedReviews();
    }
  });
});
