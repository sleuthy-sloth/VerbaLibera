import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WordBuilder, shuffledTokens } from '@/components/session/WordBuilder';

describe('shuffledTokens', () => {
  it('is deterministic per drill id and covers every token', () => {
    const first = shuffledTokens('fr-ordering-politely-build', 'Je voudrais un café');
    const second = shuffledTokens('fr-ordering-politely-build', 'Je voudrais un café');
    expect(first).toEqual(second);
    expect([...first].sort()).toEqual(['Je', 'café', 'un', 'voudrais'].sort());
  });

  it('shuffles differently across drills', () => {
    const a = shuffledTokens('a-build', 'one two three four five six');
    const b = shuffledTokens('b-build', 'one two three four five six');
    expect(a).not.toEqual(b);
  });
});

describe('WordBuilder', () => {
  it('assembles tapped words in tap order and reports the sentence', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(<WordBuilder drillId="test-build" target="Hola mundo" onAssemble={(text) => seen.push(text)} />);

    await user.click(screen.getByRole('button', { name: 'Hola' }));
    await user.click(screen.getByRole('button', { name: 'mundo' }));

    expect(seen.at(-1)).toBe('Hola mundo');
    expect(screen.getByText('Hola mundo')).toBeInTheDocument();
  });

  it('clears the assembled sentence', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(<WordBuilder drillId="test-build" target="Hola mundo" onAssemble={(text) => seen.push(text)} />);

    await user.click(screen.getByRole('button', { name: 'Hola' }));
    await user.click(screen.getByRole('button', { name: 'Clear sentence' }));

    expect(seen.at(-1)).toBe('');
  });
});
