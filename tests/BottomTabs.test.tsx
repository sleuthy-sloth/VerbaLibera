import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomTabs } from '@/components/nav/BottomTabs';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

async function pathname(path: string) {
  const nav = await import('next/navigation');
  vi.mocked(nav.usePathname).mockReturnValue(path);
}

describe('BottomTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders five primary destinations', async () => {
    await pathname('/');
    render(<BottomTabs />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daily path' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'French lessons' })).toHaveAttribute(
      'href',
      '/learn/english-to-french',
    );
    expect(screen.getByRole('link', { name: 'Italian lessons' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Spanish lessons' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Portuguese lessons' })).toBeInTheDocument();
  });

  it('marks the active course tab with aria-current', async () => {
    await pathname('/learn/english-to-spanish');
    render(<BottomTabs />);

    expect(screen.getByRole('link', { name: 'Spanish lessons' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Daily path' })).not.toHaveAttribute('aria-current');
  });
});
