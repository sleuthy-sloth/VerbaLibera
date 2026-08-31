import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('identifies VoxLibre and its two initial courses', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /VoxLibre/i })).toBeInTheDocument();
    expect(screen.getByText(/English to French/i)).toBeInTheDocument();
    expect(screen.getByText(/English to Italian/i)).toBeInTheDocument();
  });
});
