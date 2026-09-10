import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickNav } from '@/components/nav/QuickNav';
import { AppHeader } from '@/components/nav/AppHeader';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

async function pathname(path: string) {
  const nav = await import('next/navigation');
  vi.mocked(nav.usePathname).mockReturnValue(path);
}

describe('QuickNav', () => {
  it('renders Today, Courses, Listen and You — four distinct destinations', async () => {
    await pathname('/dashboard');
    render(<QuickNav />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/courses');
    expect(screen.getByRole('link', { name: 'Listen' })).toHaveAttribute('href', '/listen');
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('href', '/you');
  });

  it('never has two tabs pointing at the same URL', async () => {
    // Break caught: "Practice" defaulted to /dashboard when no course had been
    // chosen, so a first-time visitor saw Today and Practice as the same page.
    await pathname('/dashboard');
    render(<QuickNav />);

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('marks Today active on the daily path', async () => {
    await pathname('/dashboard');
    render(<QuickNav />);

    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Courses' })).not.toHaveAttribute('aria-current');
  });

  it('marks Courses active anywhere under the course library', async () => {
    await pathname('/courses/italian');
    render(<QuickNav />);

    expect(screen.getByRole('link', { name: 'Courses' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('marks Listen active on the audio path', async () => {
    await pathname('/listen');
    render(<QuickNav />);

    expect(screen.getByRole('link', { name: 'Listen' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps learner tabs off the public landing page', async () => {
    await pathname('/');
    render(<QuickNav />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('gives desktop routes the same four destinations the bottom capsule gives mobile', async () => {
    // Break caught: the bottom capsule is display:none at >=768px and nothing
    // replaced it, so /listen, /you, /login and /courses/* had no navigation.
    await pathname('/listen');
    render(<AppHeader />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/courses');
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('href', '/you');
  });

  it('stays out of the way on routes that render their own header', async () => {
    await pathname('/');
    const { container } = render(<AppHeader />);
    expect(container).toBeEmptyDOMElement();
  });
});
