import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, vi } from 'vitest';
import {
  DailyPathDashboard,
} from '@/components/dashboard/DailyPathDashboard';
import { DashboardDataBoundary } from '@/components/dashboard/DashboardDataBoundary';
import styles from '@/components/dashboard/dashboard.module.css';
import { demoProgress } from '@/features/progress/demo-progress';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function QueryTestProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DailyPathDashboard', () => {
  it('turns preview progress into a sequential daily practice path', () => {
    // Break caught: the dashboard loses its primary session entry point or progress summary.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('heading', { level: 1, name: /VoxLibre/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-french',
    );
    expect(screen.getByText(/4 of 5 daily steps/i)).toBeInTheDocument();
    expect(screen.getByText(/4-day practice flow/i)).toBeInTheDocument();
    expect(screen.getByText(/6 reviews waiting/i)).toBeInTheDocument();
    expect(screen.getByText(/preview progress/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to italian/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /daily goal/i })).toHaveAttribute(
      'aria-valuetext',
      '4 of 5 daily steps',
    );
  });

  it('switches the displayed course and session link without changing progress', async () => {
    // Break caught: local course selection mutates the fixed preview or leaves a stale CTA.
    const user = userEvent.setup();
    render(<DailyPathDashboard progress={demoProgress} />);

    await user.click(screen.getByRole('button', { name: /switch to italian/i }));

    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-italian',
    );
    expect(screen.getByText(/4 of 5 daily steps/i)).toBeInTheDocument();
    expect(demoProgress.selectedCourseSlug).toBe('english-to-french');
  });

  it('shows the selected course’s next scenario in the launch card', async () => {
    const user = userEvent.setup();
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByText('Ordering coffee or food')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /switch to italian/i }));
    expect(screen.getByText('Ordering coffee or food')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Italian selected/i })).toBeInTheDocument();
  });

  it('sources the launch scenario from the selected Italian fixture', async () => {
    // Break caught: an Italian selection keeps resolving the French session's authored concept.
    const user = userEvent.setup();
    const progressWithDistinctItalianScenario = {
      ...demoProgress,
      session: [
        ...demoProgress.session.filter((step) => step.courseSlug === 'english-to-french'),
        {
          id: 'it-pay-review-1',
          kind: 'REVIEW' as const,
          courseSlug: 'english-to-italian',
          contentId: 'it-pay-politely',
        },
      ],
    };
    render(<DailyPathDashboard progress={progressWithDistinctItalianScenario} />);

    await user.click(screen.getByRole('button', { name: /switch to italian/i }));

    expect(screen.getByText('Paying')).toBeInTheDocument();
    expect(screen.queryByText('Ordering coffee or food')).not.toBeInTheDocument();
  });

  it('initializes selection from a valid requested course slug', () => {
    // Break caught: returning from an Italian lesson resets the dashboard to the French snapshot selection.
    render(
      <DailyPathDashboard
        progress={demoProgress}
        requestedCourseSlug="english-to-italian"
      />,
    );

    expect(screen.getByRole('button', { name: /Italian selected/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-italian',
    );
  });

  it.each([undefined, 'english-to-german'])(
    'falls back to snapshot selection for a missing or invalid request (%s)',
    (requestedCourseSlug) => {
      // Break caught: malformed URL state overrides the safe progress-snapshot selection.
      render(
        <DailyPathDashboard
          progress={demoProgress}
          requestedCourseSlug={requestedCourseSlug}
        />,
      );

      expect(screen.getByRole('button', { name: /French selected/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
        'href',
        '/learn/english-to-french',
      );
    },
  );

  it('keeps the launch action and selected-course controls touch-sized', () => {
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveClass(styles.primaryAction);
    expect(screen.getByRole('button', { name: /switch to italian/i })).toHaveClass(styles.courseButton);
  });

  it('falls back to the first authored scenario when the selected course has no session', () => {
    render(<DailyPathDashboard progress={{ ...demoProgress, session: [] }} />);

    expect(screen.getByText(/greeting politely/i)).toBeInTheDocument();
  });

  it('falls back when the selected course session points to missing authored content', () => {
    render(
      <DailyPathDashboard
        progress={{
          ...demoProgress,
          session: [{ ...demoProgress.session[0], contentId: 'missing-content' }],
        }}
      />,
    );

    expect(screen.getByText(/greeting politely/i)).toBeInTheDocument();
  });

  it('uses caught-up copy when no reviews are due', () => {
    // Break caught: a zero review count is announced as work waiting anywhere on the path.
    render(<DailyPathDashboard progress={{ ...demoProgress, dueReviewCount: 0 }} />);

    expect(screen.getByText('You are caught up on reviews.')).toBeInTheDocument();
    expect(screen.queryByText(/bring six phrases back into reach/i)).not.toBeInTheDocument();
  });

  it('keeps the session action in the responsive dashboard hierarchy', () => {
    // Break caught: the mobile layout loses its root hook or its prominent action target.
    window.innerWidth = 390;
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('main')).toHaveClass(styles.dashboard);
    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveClass(
      styles.primaryAction,
    );
  });

  it('exposes high-contrast styling hooks on mixed-color focus and small-text surfaces', () => {
    // Break caught: focus falls back to the low-contrast coral ring or small indigo copy loses its contrast surface.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('main')).toHaveClass(styles.focusSurface);
    expect(screen.getByText('Up next')).toHaveClass(styles.contrastTag);
    expect(screen.getByText('English to French: A1 patterns')).toHaveClass(styles.courseMeta);
    expect(screen.getByText('80% complete')).toHaveClass(styles.courseProgress);
  });

  it('keeps every small metric label on the accessible Ink contrast hook', () => {
    // Break caught: metric labels fall back to the low-contrast 58%-Ink mixture on Cloud.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByText('Total XP')).toHaveClass(styles.metricLabel);
    expect(screen.getByText('Practice flow')).toHaveClass(styles.metricLabel);
    expect(screen.getByText('Review queue')).toHaveClass(styles.metricLabel);
  });

  it('uses the original daily-practice illustration as decorative dashboard support', () => {
    // Break caught: the approved original supporting illustration is removed or announced redundantly.
    render(<DailyPathDashboard progress={demoProgress} />);

    const illustration = screen.getByAltText('');
    expect(illustration).toHaveAttribute('src', expect.stringContaining('daily-practice.png'));
    expect(illustration.parentElement?.tagName).toBe('DIV');
  });
});

describe('DashboardDataBoundary', () => {
  it('shows a static practice-path skeleton while progress is loading', () => {
    // Break caught: an unresolved preview request leaves the page blank or unannounced.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));

    render(<DashboardDataBoundary />, { wrapper: QueryTestProvider });

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Preparing your practice path…');
  });

  it('explains a failed preview request and retries it on request', async () => {
    // Break caught: failures are not announced or retry remains actionable without an announced busy state.
    const user = userEvent.setup();
    let resolveRetry: ((response: Response) => void) | undefined;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => {
          resolveRetry = resolve;
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<DashboardDataBoundary />, { wrapper: QueryTestProvider });

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your practice path.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Trying again…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Trying to load your practice path again…');

    resolveRetry?.(new Response(JSON.stringify(demoProgress)));
    expect(await screen.findByRole('link', { name: /continue 8-minute session/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
