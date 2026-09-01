import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import HomePage from '@/app/page';
import { demoProgress } from '@/features/progress/demo-progress';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HomePage', () => {
  it('loads the Signal Pop practice dashboard with both preview courses', async () => {
    // Break caught: the public root stops connecting its data boundary to the dashboard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(demoProgress))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <HomePage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: /VoxLibre/i })).toBeInTheDocument();
    expect(screen.getByText('English to French: A1 patterns')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /switch to english to italian: a1 patterns/i }),
    ).toBeInTheDocument();
  });
});
