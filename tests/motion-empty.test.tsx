import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { YouProfile } from '@/components/you/YouProfile';
import { demoProgress } from '@/features/progress/demo-progress';

describe('Task 12: Motion & empty states', () => {
  it('globals.css defines --motion-duration', async () => {
    const css = await readFile(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toContain('--motion-duration');
  });

  it('completion check has calm animation using --motion-duration and teal check', async () => {
    const css = await readFile(
      path.join(process.cwd(), 'src/components/session/session.module.css'),
      'utf8',
    );
    // break caught: completion check has no calm motion or duration token
    expect(css).toContain('--motion-duration');
    expect(css).toMatch(/\.completionMark/);
    // should have animation or transition using motion duration
    expect(css).toMatch(/animation[^;]*var\(--motion-duration/);
    // teal/accent check border uses accent token
    expect(css).toMatch(/\.completionMark[^}]*border[^;]*var\(--accent\)/);
  });

  it('completion check has data-reduced-motion fallback', async () => {
    const css = await readFile(
      path.join(process.cwd(), 'src/components/session/session.module.css'),
      'utf8',
    );
    // break caught: missing data-reduced-motion fallback for users who prefer reduced motion
    expect(css).toContain('data-reduced-motion');
    // ensure the fallback disables animation or transition
    expect(css).toMatch(/data-reduced-motion[^}]*animation\s*:\s*none|data-reduced-motion[^}]*transition\s*:\s*none/);
  });

  it('@media (prefers-reduced-motion: reduce) disables animation for completion check', async () => {
    const css = await readFile(
      path.join(process.cwd(), 'src/components/session/session.module.css'),
      'utf8',
    );
    // break caught: reduced-motion media query missing or does not disable animation
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
    // ensure the media block contains .completionMark and disables animation (not just transition)
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*\.completionMark[\s\S]*animation\s*:\s*none/);
  });

  it('empty review queue shows honest caught-up copy', async () => {
    // Break caught: empty queue still shows stale caught-up or streak-shame copy.
    // The queue lives on the profile now.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...demoProgress, dueReviewCount: 0 }))),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    render(<YouProfile />, { wrapper });
    expect(
      await screen.findByText("You're caught up — one pattern tomorrow keeps the flow."),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('globals.css honors the manual reduce-motion preference', async () => {
    // Break caught: the /you Reduce motion toggle writes data-motion with no CSS honoring it.
    const css = await readFile(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toMatch(/html\[data-motion='reduced'\][\s\S]*animation-duration/);
  });
});
