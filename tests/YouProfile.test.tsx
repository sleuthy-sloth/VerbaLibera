import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YouProfile } from '@/components/you/YouProfile';
import { blankDemoProgress, demoProgress } from '@/features/progress/demo-progress';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function QueryTestProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

function mockProgressFetch(snapshot: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot))),
  );
}

describe('YouProfile', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.textSize;
    delete document.documentElement.dataset.motion;
  });

  it('leads with what the learner can say, not with XP and streaks', async () => {
    // Break caught: the profile marketed itself on XP and a streak counter that
    // the landing page explicitly promises not to have ("no streaks to break, no
    // meter you're failing"), and told the learner nothing about the language.
    mockProgressFetch({ ...blankDemoProgress, isPreview: true });
    render(<YouProfile />, { wrapper: QueryTestProvider });

    expect(await screen.findByRole('heading', { name: 'What you can say' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(screen.queryByText(/XP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.getByText(/nothing yet\. finish a lesson/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /keep this on my account/i })).toHaveAttribute('href', '/login');
  });

  it('lists the phrases a learner has met once they have progress', async () => {
    mockProgressFetch({ ...demoProgress, isPreview: false });
    render(<YouProfile />, { wrapper: QueryTestProvider });

    const said = await screen.findByRole('heading', { name: 'What you can say' });
    const section = said.closest('section');
    expect(section?.querySelectorAll('li').length).toBeGreaterThan(0);
    // Target-language phrases carry a lang attribute so screen readers do not
    // read French with English phonemes.
    expect(section?.querySelector('[lang="fr"]')).not.toBeNull();
  });

  it('shows real stats and sign-out for signed-in learners', async () => {
    mockProgressFetch({ ...demoProgress, isPreview: false });
    render(<YouProfile />, { wrapper: QueryTestProvider });

    expect(await screen.findByText('Saved to your account')).toBeInTheDocument();
    expect(screen.getByText(/28 reviews waiting/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('uses caught-up copy on the profile when no reviews are due', async () => {
    // Break caught: a zero review count is announced as work waiting.
    mockProgressFetch({ ...blankDemoProgress, isPreview: true, dueReviewCount: 0 });
    render(<YouProfile />, { wrapper: QueryTestProvider });

    expect(await screen.findByText(/You're caught up — one pattern tomorrow keeps the flow\./)).toBeInTheDocument();
  });

  it('persists accessibility prefs to the browser and the document root', async () => {
    mockProgressFetch({ ...blankDemoProgress, isPreview: true });
    const user = userEvent.setup();
    render(<YouProfile />, { wrapper: QueryTestProvider });

    const largerText = await screen.findByRole('checkbox', { name: /larger text/i });
    const reduceMotion = screen.getByRole('checkbox', { name: /reduce motion/i });
    await user.click(largerText);
    await user.click(reduceMotion);

    expect(document.documentElement.dataset.textSize).toBe('large');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(JSON.parse(localStorage.getItem('verbalibera_a11y') ?? '{}')).toMatchObject({
      largeText: true,
      reduceMotion: true,
    });

    await user.click(largerText);
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });
});
