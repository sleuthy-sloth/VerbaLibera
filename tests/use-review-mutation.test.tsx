import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { demoProgress } from '@/features/progress/demo-progress';
import { useReviewMutation } from '@/features/progress/use-review-mutation';
import { Toast } from '@/components/ui/Toast';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DemoProgressSnapshot } from '@/features/progress/types';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function CountReader() {
  const { data } = useQuery<DemoProgressSnapshot>({
    queryKey: ['demo', 'progress'],
    queryFn: async () => demoProgress,
  });
  return <span data-testid="due-count">{data?.dueReviewCount ?? 'unknown'}</span>;
}

function MutationHarness({
  queryClient,
  onInvalidateSpy,
}: {
  queryClient: QueryClient;
  onInvalidateSpy?: ReturnType<typeof vi.fn>;
}) {
  const mutation = useReviewMutation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Wrap invalidate to spy if provided
  if (onInvalidateSpy) {
    // spy already attached to queryClient via vi.spyOn
  }

  return (
    <div>
      <CountReader />
      <button
        type="button"
        onClick={() =>
          mutation.mutate(
            {
              drillItemId: 'fr-ordering-politely-drill',
              verdict: 'exact',
              latencyMs: 1200,
              clientMutationId: 'test-mut-1',
            },
            {
              onSuccess: () => setToastMessage('Progress saved'),
              onError: () => setToastMessage('Could not save progress. Please try again.'),
            },
          )
        }
      >
        I got it
      </button>
      <button
        type="button"
        onClick={() =>
          mutation.mutate(
            {
              drillItemId: 'fr-ordering-politely-drill',
              verdict: 'try_again',
              latencyMs: 1200,
              clientMutationId: 'test-mut-2',
            },
            {
              onSuccess: () => setToastMessage('Progress saved'),
              onError: () => setToastMessage('Could not save progress. Please try again.'),
            },
          )
        }
      >
        Try again
      </button>
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      {/* expose mutation key for assertion */}
      <span data-testid="mutation-key">{JSON.stringify((mutation as unknown as { mutationKey?: unknown }).mutationKey ?? ['progress', 'review'])}</span>
    </div>
  );
}

describe('useReviewMutation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('optimistically decrements dueReviewCount and rolls back on error with toast role=status', async () => {
    const user = userEvent.setup();
    // Mock fetch to delay then fail
    let rejectFetch: (err: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((_resolve, reject) => {
      rejectFetch = reject;
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const queryClient = createQueryClient();
    // Seed cache with 6 reviews
    queryClient.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });
    queryClient.setQueryData(['demo-progress'], { ...demoProgress, dueReviewCount: 6 });

    render(
      <QueryClientProvider client={queryClient}>
        <MutationHarness queryClient={queryClient} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('due-count')).toHaveTextContent('6');

    await user.click(screen.getByRole('button', { name: 'I got it' }));

    // optimistic should have decremented to 5 synchronously
    await waitFor(() => expect(screen.getByTestId('due-count')).toHaveTextContent('5'));

    // Now fail the fetch
    await act(async () => {
      rejectFetch(new Error('network'));
      // also need to reject with ok false? Our mutation checks !ok throw. But network reject also triggers onError
      // give tick for state updates
      await new Promise((r) => setTimeout(r, 0));
    });

    // Should roll back to 6
    await waitFor(() => expect(screen.getByTestId('due-count')).toHaveTextContent('6'));

    // Toast role=status should appear with error message
    expect(await screen.findByRole('status')).toHaveTextContent(/Could not save progress/i);
  });

  it('shows toast role=status on success after delay', async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const queryClient = createQueryClient();
    queryClient.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });

    render(
      <QueryClientProvider client={queryClient}>
        <MutationHarness queryClient={queryClient} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'I got it' }));

    await waitFor(() => expect(screen.getByTestId('due-count')).toHaveTextContent('5'));

    await act(async () => {
      resolveFetch(new Response(JSON.stringify({ status: 'ok', nextReviewAt: new Date().toISOString(), intervalDays: 1 }), { status: 200 }));
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Progress saved/i));
  });

  it('invalidates [\'demo\',\'progress\'] on success', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', nextReviewAt: new Date().toISOString(), intervalDays: 1 }), { status: 200 }))) as unknown as typeof fetch,
    );

    const queryClient = createQueryClient();
    queryClient.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <MutationHarness queryClient={queryClient} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'I got it' }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());

    const calls = invalidateSpy.mock.calls;
    const hasDemoProgressInvalidation = calls.some(
      ([arg]) =>
        arg &&
        typeof arg === 'object' &&
        'queryKey' in arg &&
        Array.isArray((arg as { queryKey: unknown }).queryKey) &&
        JSON.stringify((arg as { queryKey: unknown }).queryKey) === JSON.stringify(['demo', 'progress']),
    );
    expect(hasDemoProgressInvalidation).toBe(true);

    // also ensures toast appears
    expect(await screen.findByRole('status')).toHaveTextContent(/Progress saved/i);
  });

  it('uses mutationKey [\'progress\',\'review\']', async () => {
    // Verify source file defines correct key - import and check that hook would set it
    // We verify by inspecting that a mutation with that key is registered after mutate
    const queryClient = createQueryClient();
    queryClient.setQueryData(['demo', 'progress'], { ...demoProgress, dueReviewCount: 6 });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);

    render(
      <QueryClientProvider client={queryClient}>
        <MutationHarness queryClient={queryClient} />
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Check mutation cache has key ['progress','review']
    await waitFor(() => {
      const mutations = queryClient.getMutationCache().getAll();
      expect(mutations.length).toBeGreaterThan(0);
      const hasKey = mutations.some((m) => {
        const opts = m.options as { mutationKey?: unknown };
        return JSON.stringify(opts.mutationKey) === JSON.stringify(['progress', 'review']);
      });
      expect(hasKey).toBe(true);
    });
  });

  it('toast auto-dismisses after 3s', async () => {
    const onDismiss = vi.fn();
    render(<Toast message="Progress saved" onDismiss={onDismiss} durationMs={100} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(onDismiss).toHaveBeenCalled(), { timeout: 1000 });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 1000 });
  });

  it('toast respects prefers-reduced-motion', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const cssPath = path.resolve(process.cwd(), 'src/components/ui/toast.module.css');
    const content = fs.readFileSync(cssPath, 'utf8');
    expect(content).toMatch(/prefers-reduced-motion/);
  });
});
