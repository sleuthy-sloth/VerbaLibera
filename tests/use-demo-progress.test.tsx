import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, vi } from 'vitest';
import { demoProgress } from '@/features/progress/demo-progress';
import { useDemoProgress } from '@/features/progress/use-demo-progress';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function QueryTestProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function ProgressConsumer() {
  const { data, error } = useDemoProgress();

  if (error) return <p>{error.message}</p>;
  return <p>{data ? `${data.dueReviewCount} reviews due` : 'Loading'}</p>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDemoProgress', () => {
  it('renders the due review count from the preview snapshot', async () => {
    // Break caught: the hook fails to load preview progress into its consumer.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(demoProgress))));

    render(<ProgressConsumer />, { wrapper: QueryTestProvider });

    expect(await screen.findByText('12 reviews due')).toBeInTheDocument();
  });

  it('renders the practice-path message when the preview request fails', async () => {
    // Break caught: a failed preview request does not surface actionable feedback.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    render(<ProgressConsumer />, { wrapper: QueryTestProvider });

    expect(await screen.findByText('Unable to load your practice path.')).toBeInTheDocument();
  });
});
