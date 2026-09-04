import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, afterEach } from 'vitest';
import { ClozeBuilder, splitClozeTemplate } from '@/components/session/ClozeBuilder';
import { GuidedSession } from '@/components/session/GuidedSession';
import { demoProgress } from '@/features/progress/demo-progress';

describe('splitClozeTemplate', () => {
  it('splits a single-blank template into text and blank parts', () => {
    expect(splitClozeTemplate('Hier soir, nous ____ au café.')).toEqual([
      { kind: 'text', value: 'Hier soir, nous ' },
      { kind: 'blank', index: 0 },
      { kind: 'text', value: ' au café.' },
    ]);
  });

  it('numbers multiple blanks in order', () => {
    const parts = splitClozeTemplate('____ ____ demain.');
    expect(parts.filter((part) => part.kind === 'blank')).toHaveLength(2);
  });

  it('returns plain text with no blanks untouched', () => {
    expect(splitClozeTemplate('No blanks here.')).toEqual([
      { kind: 'text', value: 'No blanks here.' },
    ]);
  });
});

describe('ClozeBuilder', () => {
  it('renders one input per blank and assembles the full sentence', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(
      <ClozeBuilder
        template="Hier soir, nous ____ au café."
        onAssemble={(text) => seen.push(text)}
      />,
    );

    const input = screen.getByLabelText(/blank 1/i);
    await user.type(input, 'avons mangé');

    expect(seen.at(-1)).toBe('Hier soir, nous avons mangé au café.');
  });

  it('reports an empty assembly when blanks are cleared', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(
      <ClozeBuilder
        template="Hier soir, nous ____ au café."
        onAssemble={(text) => seen.push(text)}
      />,
    );

    await user.type(screen.getByLabelText(/blank 1/i), 'avons mangé');
    await user.clear(screen.getByLabelText(/blank 1/i));

    expect(seen.at(-1)).toBe('');
  });
});

describe('ClozeBuilder in GuidedSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fills the blank, checks the assembled sentence, and earns an exact verdict', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              verdict: 'exact',
              matchedVariant: 'Hier soir, nous avons mangé au petit café de la gare.',
              limited: false,
            }),
        }),
      ),
    );
    const progress = {
      ...demoProgress,
      session: [
        {
          id: 'fr-ordering-politely-cloze-1',
          kind: 'DRILL' as const,
          courseSlug: 'english-to-french',
          contentId: 'fr-ordering-politely',
          drillId: 'fr-ordering-politely-cloze',
        },
      ],
    };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <GuidedSession progress={progress} courseSlug="english-to-french" />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText(/blank 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeDisabled();

    await user.type(screen.getByLabelText(/blank 1/i), 'avons mangé');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));

    expect(await screen.findByText('That matches an accepted answer.')).toBeInTheDocument();
  });
});
