import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PictureChoice } from '@/components/session/PictureChoice';

const CHOICES = [
  { id: 'coffee', imageUrl: '/images/vocab/coffee.jpg', alt: 'A cup of coffee' },
  { id: 'tea', imageUrl: '/images/vocab/tea.jpg', alt: 'A cup of tea' },
  { id: 'table', imageUrl: '/images/vocab/table.jpg', alt: 'A café table' },
  { id: 'bill', imageUrl: '/images/vocab/bill.jpg', alt: 'A restaurant bill' },
] as const;

describe('PictureChoice', () => {
  it('renders one radio per choice with accessible names', () => {
    render(
      <PictureChoice
        prompt="Which picture shows “un café”? Tap it."
        choices={[...CHOICES]}
        recallTarget="coffee"
        onVerdict={() => {}}
      />,
    );

    expect(screen.getByText(/Which picture shows/)).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'A cup of coffee' })).toBeInTheDocument();
  });

  it('reports exact when the correct picture is tapped', async () => {
    const user = userEvent.setup();
    const onVerdict = vi.fn();
    render(
      <PictureChoice
        prompt="Which picture shows “un café”? Tap it."
        choices={[...CHOICES]}
        recallTarget="coffee"
        onVerdict={onVerdict}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'A cup of coffee' }));

    expect(onVerdict).toHaveBeenCalledTimes(1);
    expect(onVerdict).toHaveBeenCalledWith('exact', 'coffee');
    expect(await screen.findByText('That is the right picture.')).toBeInTheDocument();
  });

  it('reports try_again when the wrong picture is tapped and locks further taps', async () => {
    const user = userEvent.setup();
    const onVerdict = vi.fn();
    render(
      <PictureChoice
        prompt="Which picture shows “un café”? Tap it."
        choices={[...CHOICES]}
        recallTarget="coffee"
        onVerdict={onVerdict}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'A cup of tea' }));
    expect(onVerdict).toHaveBeenCalledWith('try_again', 'tea');

    await user.click(screen.getByRole('radio', { name: 'A café table' }));
    expect(onVerdict).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Not that one/)).toBeInTheDocument();
  });

  it('is keyboard operable', async () => {
    const user = userEvent.setup();
    const onVerdict = vi.fn();
    render(
      <PictureChoice
        prompt="Which picture shows “un café”? Tap it."
        choices={[...CHOICES]}
        recallTarget="coffee"
        onVerdict={onVerdict}
      />,
    );

    screen.getByRole('radio', { name: 'A restaurant bill' }).focus();
    await user.keyboard('{Enter}');
    expect(onVerdict).toHaveBeenCalledWith('try_again', 'bill');
  });
});
