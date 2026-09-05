'use client';

import { csrfHeaders } from '@/lib/auth/cookies';


import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueReview, replayQueuedReviews } from '@/lib/progress/offline-queue';
import type { DemoProgressSnapshot } from './types';

export type ReviewInput = Readonly<{
  drillItemId: string;
  verdict: 'exact' | 'close' | 'try_again';
  latencyMs?: number | null;
  clientMutationId?: string;
}>;

type MutationContext = {
  previousDemoProgress?: DemoProgressSnapshot;
  previousLegacy?: DemoProgressSnapshot;
};

function applyOptimisticDecrement(snapshot: DemoProgressSnapshot): DemoProgressSnapshot {
  return {
    ...snapshot,
    dueReviewCount: Math.max(0, snapshot.dueReviewCount - 1),
  };
}

export function useReviewMutation() {
  const queryClient = useQueryClient();

  // Replay queued reviews when connectivity returns.
  // Keeps the optimistic UI honest: queued reviews are retried with idempotent clientMutationId.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    let cancelled = false;

    const handleOnline = async () => {
      if (cancelled) return;
      try {
        const result = await replayQueuedReviews();
        if (!cancelled && result.succeeded > 0) {
          queryClient.invalidateQueries({ queryKey: ['demo', 'progress'] });
          queryClient.invalidateQueries({ queryKey: ['demo-progress'] });
        }
      } catch {
        // Will retry on next online event
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [queryClient]);

  return useMutation<unknown, Error, ReviewInput, MutationContext>({
    mutationKey: ['progress', 'review'],
    mutationFn: async (input: ReviewInput) => {
      const clientMutationId =
        input.clientMutationId?.trim() ||
        `${input.drillItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload: ReviewInput = { ...input, clientMutationId };

      // Offline queue: persist optimistic review and show offline toast.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueueReview(payload);

        // Show transient toast for accessibility and testability.
        // Uses a direct DOM injection so the hook works even without a parent Toast provider.
        if (typeof document !== 'undefined' && typeof window !== 'undefined') {
          try {
            const existing = document.querySelector('[data-testid="offline-queue-toast"]');
            existing?.remove();
            const toastEl = document.createElement('div');
            toastEl.setAttribute('role', 'status');
            toastEl.setAttribute('aria-live', 'polite');
            toastEl.setAttribute('data-testid', 'offline-queue-toast');
            toastEl.textContent = "Will sync when you're back online";
            // Minimal inline positioning — styling is secondary to a11y role.
            toastEl.style.position = 'fixed';
            toastEl.style.bottom = '1rem';
            toastEl.style.left = '50%';
            toastEl.style.transform = 'translateX(-50%)';
            toastEl.style.zIndex = '9999';
            document.body.appendChild(toastEl);
            setTimeout(() => {
              toastEl.remove();
            }, 3000);
          } catch {
            // ignore DOM errors in test/SSR
          }
          try {
            window.dispatchEvent(
              new CustomEvent('verbalibera:offline-queued', { detail: payload }),
            );
          } catch {}
        }

        // Return queued marker to keep optimistic decrement and avoid error rollback.
        return { status: 'queued', offline: true, clientMutationId } as unknown;
      }

      const response = await fetch('/api/progress/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Unable to save review.');
      }
      return response.json() as Promise<unknown>;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['demo', 'progress'] });
      await queryClient.cancelQueries({ queryKey: ['demo-progress'] });

      const previousDemoProgress = queryClient.getQueryData<DemoProgressSnapshot>(['demo', 'progress']);
      const previousLegacy = queryClient.getQueryData<DemoProgressSnapshot>(['demo-progress']);

      if (previousDemoProgress) {
        queryClient.setQueryData<DemoProgressSnapshot>(
          ['demo', 'progress'],
          applyOptimisticDecrement(previousDemoProgress),
        );
      }
      if (previousLegacy) {
        queryClient.setQueryData<DemoProgressSnapshot>(
          ['demo-progress'],
          applyOptimisticDecrement(previousLegacy),
        );
      }

      return { previousDemoProgress, previousLegacy };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDemoProgress !== undefined) {
        queryClient.setQueryData(['demo', 'progress'], context.previousDemoProgress);
      }
      if (context?.previousLegacy !== undefined) {
        queryClient.setQueryData(['demo-progress'], context.previousLegacy);
      }
    },
    onSuccess: (data) => {
      // Queued offline — keep optimistic state, will invalidate on replay.
      if (data && typeof data === 'object' && (data as { offline?: boolean }).offline) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['demo', 'progress'] });
      queryClient.invalidateQueries({ queryKey: ['demo-progress'] });
    },
  });
}
