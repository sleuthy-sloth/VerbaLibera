'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
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

  return useMutation<unknown, Error, ReviewInput, MutationContext>({
    mutationKey: ['progress', 'review'],
    mutationFn: async (input: ReviewInput) => {
      const response = await fetch('/api/progress/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo', 'progress'] });
      queryClient.invalidateQueries({ queryKey: ['demo-progress'] });
    },
  });
}
