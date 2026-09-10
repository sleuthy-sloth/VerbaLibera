import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import HomePage from '@/app/dashboard/page';
import { demoProgress } from '@/features/progress/demo-progress';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HomePage', () => {
  it('loads the Quiet Ink practice dashboard with both preview courses', async () => {
    // Break caught: the dashboard route stops connecting its data boundary to the dashboard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(demoProgress))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const page = await HomePage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });
    render(
      <QueryClientProvider client={client}>
        {page}
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: /VerbaLibera/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Learning language' })).toHaveValue('english-to-french');
    expect(await screen.findByRole('link', { name: /continue today.s lesson/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /today.s lesson/i })).toBeInTheDocument();
  });

  it('uses a valid course query to restore the dashboard selection', async () => {
    // Break caught: the server page drops the selected-course query before data reaches the dashboard.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(demoProgress))));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = await HomePage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ course: 'english-to-italian' }),
    });

    render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);

    expect(await screen.findByRole('combobox', { name: 'Learning language' })).toHaveValue('english-to-italian');
    expect(screen.getByRole('link', { name: /continue today.s lesson/i })).toHaveAttribute(
      'href',
      '/learn/english-to-italian',
    );
  });
});
