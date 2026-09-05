import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { PlacementQuiz } from '@/components/placement/PlacementQuiz';
import { frenchPlacementItems } from '@/features/placement/items';

// Match offline-queue.test.ts: Vitest's jsdom url can be opaque, so provide
// a Map-backed localStorage mock when the native one is missing.
function ensureMockLocalStorage() {
  const createMock = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      get length() {
        return store.size;
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
    } as unknown as Storage;
  };
  let needsMock = true;
  try {
    const ls = (window as unknown as { localStorage?: Storage }).localStorage;
    needsMock = !ls || typeof ls.clear !== 'function';
  } catch {
    needsMock = true;
  }
  if (needsMock) {
    const mock = createMock();
    try {
      Object.defineProperty(window, 'localStorage', { value: mock, configurable: true, writable: true });
    } catch {}
    try {
      Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true, writable: true });
    } catch {}
  }
}

ensureMockLocalStorage();

beforeEach(() => {
  localStorage.clear();
});

async function answerAllCorrectly() {
  const user = userEvent.setup();
  render(<PlacementQuiz courseSlug="english-to-french" />);

  for (let index = 0; index < frenchPlacementItems.length; index++) {
    const item = frenchPlacementItems[index]!;
    if (item.kind === 'CHOICE') {
      await user.click(screen.getByRole('radio', { name: item.answerKey! }));
    } else if (item.kind === 'CLOZE') {
      const assembled = item.acceptedResponses[0]!;
      const template = item.prompt.replace(/^Complete[^:]*: /, '');
      const [before, after] = template.split('____');
      const blankValue = assembled.replace(before!, '').replace(after!, '');
      await user.type(screen.getByLabelText(/blank 1/i), blankValue);
    } else {
      await user.type(screen.getByLabelText(/your answer/i), item.acceptedResponses[0]!);
    }
    if (index < frenchPlacementItems.length - 1) {
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
  }
  return user;
}

describe('PlacementQuiz', () => {
  it('walks all 15 items and shows the top band with a start action', async () => {
    const user = await answerAllCorrectly();

    await user.click(screen.getByRole('button', { name: 'See my result' }));

    expect(screen.getByText(/above our current content/i)).toBeInTheDocument();
    expect(screen.getByText(/15 of 15/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start learning/i })).toHaveAttribute(
      'href',
      '/learn/english-to-french?concept=fr-ask-directions',
    );
  });

  it('persists the result for the dashboard to read later', async () => {
    const user = await answerAllCorrectly();
    await user.click(screen.getByRole('button', { name: 'See my result' }));

    const saved = JSON.parse(localStorage.getItem('verbalibera_placement:english-to-french') ?? 'null');
    expect(saved).toMatchObject({ score: 15, band: 'B1+' });
  });

  it('restores a saved result instead of restarting the quiz', async () => {
    localStorage.setItem(
      'verbalibera_placement',
      JSON.stringify({ score: 3, total: 15, band: 'A1', startCefr: 'A1', startConceptId: 'fr-greet-politely', stretchUnlocked: false, aboveContent: false }),
    );
    render(<PlacementQuiz courseSlug="english-to-french" />);

    expect(await screen.findByText(/starting at the beginning/i)).toBeInTheDocument();
    expect(screen.queryByText(/placement · 1 of 15/i)).not.toBeInTheDocument();
  });
});
