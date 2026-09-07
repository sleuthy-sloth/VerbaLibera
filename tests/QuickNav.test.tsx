import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickNav } from '@/components/nav/QuickNav';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

async function pathname(path: string) {
  const nav = await import('next/navigation');
  vi.mocked(nav.usePathname).mockReturnValue(path);
}

describe('QuickNav', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  });

  it('renders Today, Practice, Listen and You — never per-language tabs', async () => {
    await pathname('/dashboard');
    render(<QuickNav />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daily path' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Resume practice' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Audio lessons' })).toHaveAttribute('href', '/listen');
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/you');
    expect(screen.queryByRole('link', { name: 'French lessons' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Italian lessons' })).not.toBeInTheDocument();
  });

  it('points Practice at the last-used course', async () => {
    localStorage.setItem('verbalibera_course', 'english-to-italian');
    await pathname('/dashboard');
    render(<QuickNav />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Resume practice' })).toHaveAttribute(
        'href',
        '/courses/italian?start=1',
      );
    });
  });

  it('marks Practice active inside lessons and courses', async () => {
    await pathname('/courses/italian');
    render(<QuickNav />);

    expect(screen.getByRole('link', { name: 'Resume practice' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Daily path' })).not.toHaveAttribute('aria-current');
  });

  it('marks Listen active on the audio path', async () => {
    await pathname('/listen');
    render(<QuickNav />);

    expect(screen.getByRole('link', { name: 'Audio lessons' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Resume practice' })).not.toHaveAttribute('aria-current');
  });
});

it('keeps learner tabs off the public landing page', async () => {
  await pathname('/');
  render(<QuickNav />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
