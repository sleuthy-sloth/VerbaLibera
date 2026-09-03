'use client';

import { useQuery } from '@tanstack/react-query';
import type { DemoProgressSnapshot } from './types';

export function useDemoProgress() {
  return useQuery({
    queryKey: ['demo', 'progress'],
    queryFn: async (): Promise<DemoProgressSnapshot> => {
      const response = await fetch('/api/demo/progress', { cache: 'no-store' });

      if (!response.ok) throw new Error('Unable to load your practice path.');

      return response.json() as Promise<DemoProgressSnapshot>;
    },
  });
}
