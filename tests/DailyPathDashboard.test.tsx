import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

function maskCssComments(stylesheet: string) {
  return stylesheet.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
}

function normalizeMediaCondition(condition: string) {
  return condition.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function topLevelMediaBlocks(stylesheet: string) {
  const blocks: Array<{ condition: string; content: string; start: number; end: number }> = [];
  const searchableStylesheet = maskCssComments(stylesheet).toLowerCase();
  let cursor = 0;

  while (cursor < stylesheet.length) {
    if (!searchableStylesheet.startsWith('@media', cursor)) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    const openingBrace = searchableStylesheet.indexOf('{', start);
    let depth = 1;
    cursor = openingBrace + 1;

    while (cursor < stylesheet.length && depth > 0) {
      if (searchableStylesheet[cursor] === '{') depth += 1;
      if (searchableStylesheet[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    if (openingBrace > -1 && depth === 0) {
      blocks.push({
        condition: normalizeMediaCondition(stylesheet.slice(start + '@media'.length, openingBrace)),
        content: stylesheet.slice(openingBrace + 1, cursor - 1),
        start,
        end: cursor,
      });
    }
  }

  return blocks;
}

function hasLegacyWidthCondition(condition: string, qualifier: 'min' | 'max', pixels: number) {
  return new RegExp(`${qualifier}-\\s*width\\s*:\\s*${pixels}\\s*px\\b`).test(condition);
}

function includesDesktopWidthAt760(condition: string) {
  return (
    hasLegacyWidthCondition(condition, 'min', 760) ||
    /\bwidth\s*>=\s*760\s*px\b/.test(condition) ||
    /\b760\s*px\s*<=\s*width\b/.test(condition)
  );
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
    expect(screen.getByRole('button', { name: /english to italian: a1 patterns/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /daily goal/i })).toHaveAttribute(
      'aria-valuetext',
      '4 of 5 daily steps',
    );
  });

  it('switches the displayed course using only preview data', async () => {
    // Break caught: local course selection mutates preview data or links to a session the snapshot did not provide.
    const user = userEvent.setup();
    render(<DailyPathDashboard progress={demoProgress} />);

    await user.click(screen.getByRole('button', { name: /english to italian: a1 patterns/i }));

    expect(screen.getByRole('link', { name: /continue 8-minute session/i })).toHaveAttribute(
      'href',
      '/learn/english-to-italian',
    );
    expect(screen.getByText(/4 of 5 daily steps/i)).toBeInTheDocument();
    expect(demoProgress.selectedCourseSlug).toBe('english-to-french');
  });

  it('renders every available course instead of assuming a fixed language pair', () => {
    // Break caught: adding a course leaves it inaccessible behind French/Italian-specific selector copy.
    render(
      <DailyPathDashboard
        progress={{
          ...demoProgress,
          selectedCourseSlug: 'english-to-german',
          courses: [
            ...demoProgress.courses,
            {
              slug: 'english-to-german',
              title: 'English to German: A1 patterns',
              unitLabel: 'Unit 1: Meeting someone',
              completionPercent: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /english to german: a1 patterns/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders generic course segments in the header', () => {
    // Break caught: course selection falls back to a separate, language-specific course lane.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('button', { name: /english to french: a1 patterns/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('heading', { name: /your course lane/i })).not.toBeInTheDocument();
  });

  it('keeps goal and three steps in the Today card', () => {
    // Break caught: daily-path content is split between a session card and a separate path section.
    render(<DailyPathDashboard progress={demoProgress} />);

    const today = screen.getByRole('region', { name: /today's 8-minute path/i });
    expect(today).toHaveTextContent('Review');
    expect(today).toHaveTextContent('Drill');
    expect(today).toHaveTextContent('Pattern');
    expect(within(today).getByRole('progressbar', { name: /daily goal/i })).toBeInTheDocument();
  });

  it('shows the review queue once, in Progress snapshot', () => {
    // Break caught: the review count is repeated in the daily path instead of living in the secondary snapshot.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getAllByText(/6 reviews waiting/i)).toHaveLength(1);
  });

  it('does not link an available course to a session that has not been supplied yet', () => {
    // Break caught: selecting a future course sends the learner to an unavailable guided-session route.
    render(
      <DailyPathDashboard
        progress={{
          ...demoProgress,
          selectedCourseSlug: 'english-to-german',
          session: [
            ...demoProgress.session,
            { id: 'de-greeting-drill-1', kind: 'DRILL', courseSlug: 'english-to-german', contentId: 'de-greeting', drillId: 'de-greeting-drill' },
          ],
          courses: [
            ...demoProgress.courses,
            {
              slug: 'english-to-german',
              title: 'English to German: A1 patterns',
              unitLabel: 'Unit 1: Meeting someone',
              completionPercent: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Session preview coming soon')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /continue 8-minute session/i })).not.toBeInTheDocument();
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

  it('keeps the 760px boundary in the one-column, full-width-action layout', () => {
    // Break caught: a desktop breakpoint at 760px turns the binding mobile boundary into two columns.
    const dashboardStyles = readFileSync(
      resolve(process.cwd(), 'src/components/dashboard/dashboard.module.css'),
      'utf8',
    );
    const mediaBlocks = topLevelMediaBlocks(dashboardStyles);
    const desktopBlock = mediaBlocks.find((block) =>
      hasLegacyWidthCondition(block.condition, 'min', 761),
    );
    const mobileBlock = mediaBlocks.find((block) =>
      hasLegacyWidthCondition(block.condition, 'max', 760),
    );
    const desktopGrid = /\.dashboardGrid\s*\{[^}]*grid-template-columns\s*:/;
    const stickyProgress = /\.progressPanel\s*\{[^}]*position\s*:\s*sticky\s*;/;
    const fullWidthCta = /\.primaryAction\s*,\s*\.pendingAction\s*\{[^}]*width\s*:\s*100%\s*;/;

    expect(mediaBlocks.some((block) => includesDesktopWidthAt760(block.condition))).toBe(false);
    expect(desktopBlock).toBeDefined();
    expect(mobileBlock).toBeDefined();
    expect(desktopBlock?.content).toMatch(desktopGrid);
    expect(desktopBlock?.content).toMatch(stickyProgress);
    expect(mobileBlock?.content).toMatch(fullWidthCta);
    expect(mobileBlock?.content).not.toMatch(desktopGrid);
    expect(mobileBlock?.content).not.toMatch(stickyProgress);
    expect(desktopBlock?.content).not.toMatch(fullWidthCta);

    const outsideDesktop = dashboardStyles.slice(0, desktopBlock?.start) + dashboardStyles.slice(desktopBlock?.end);
    const outsideMobile = dashboardStyles.slice(0, mobileBlock?.start) + dashboardStyles.slice(mobileBlock?.end);
    expect(outsideDesktop).not.toMatch(desktopGrid);
    expect(outsideDesktop).not.toMatch(stickyProgress);
    expect(outsideMobile).not.toMatch(fullWidthCta);
  });

  it.each([
    '@media (min-width: 760px)',
    '@MEDIA (MIN-WIDTH: /* boundary */ 760PX)',
    '@media (width >= 760px)',
    '@MEDIA (WIDTH /* boundary */ >= 760PX)',
    '@media (760px <= width)',
    '@MEDIA (760PX /* boundary */ <= WIDTH)',
  ])('recognizes a forbidden desktop boundary condition in %s', (mediaQuery) => {
    // Break caught: a desktop query at 760px evades the guard through syntax, operand order, comments, or casing.
    const mediaBlocks = topLevelMediaBlocks(`${mediaQuery} { .futureRule { display: grid; } }`);

    expect(mediaBlocks).toHaveLength(1);
    expect(includesDesktopWidthAt760(mediaBlocks[0]?.condition ?? '')).toBe(true);
  });

  it('exposes high-contrast styling hooks on mixed-color focus and small-text surfaces', () => {
    // Break caught: focus falls back to the low-contrast coral ring or small indigo copy loses its contrast surface.
    render(<DailyPathDashboard progress={demoProgress} />);

    expect(screen.getByRole('main')).toHaveClass(styles.focusSurface);
    expect(screen.getByText('Up next')).toHaveClass(styles.contrastTag);
    expect(screen.getByText('English to French: A1 patterns')).toHaveClass(styles.courseMeta);
    expect(screen.getByRole('button', { name: /english to french: a1 patterns/i })).toHaveClass(
      styles.courseSegment,
    );
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
