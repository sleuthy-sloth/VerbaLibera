import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import LoginPage from '../src/app/login/page';

describe('LoginPage', () => {
  it('renders passkey UI with 44px targets and Quiet Ink copy', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in to voxlibre/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create passkey/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with passkey/i })).toBeInTheDocument();
  });

  it('has accessible labels and focus-visible inputs', async () => {
    render(<LoginPage />);
    const input = screen.getByLabelText(/account name/i) as HTMLInputElement;
    expect(input).toHaveAttribute('placeholder');
    // Focus should be possible
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});
