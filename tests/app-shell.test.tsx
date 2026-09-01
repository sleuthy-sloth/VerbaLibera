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

    const page = await HomePage({ searchParams: Promise.resolve({}) });
    render(
      <QueryClientProvider client={client}>
        {page}
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: /VoxLibre/i })).toBeInTheDocument();
    expect(screen.getByText(/English to French: A1 patterns/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to italian/i })).toBeInTheDocument();
  });

  it('uses a valid course query to restore the dashboard selection', async () => {
    // Break caught: the server page drops the selected-course query before data reaches the dashboard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(demoProgress))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = await HomePage({
      searchParams: Promise.resolve({ course: 'english-to-italian' }),
    });

    render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);

    expect(await screen.findByRole('button', { name: /Italian selected/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-italian',
    );
  });
});
