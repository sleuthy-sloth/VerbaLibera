import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { PlacementQuiz } from '@/components/placement/PlacementQuiz';

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

async function answerFoundationIncorrectly() {
  const user = userEvent.setup();
  render(<PlacementQuiz courseSlug="english-to-french" />);

  await user.click(screen.getAllByRole('radio').at(-1)!);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.click(screen.getAllByRole('radio').at(-1)!);
  await user.click(screen.getByRole('button', { name: 'Continue' }));

  await user.type(screen.getByLabelText(/your answer/i), 'wrong answer');
  await user.click(screen.getByRole('button', { name: 'See my result' }));
  return user;
}

describe('PlacementQuiz', () => {
  it('ends early after unsuccessful foundation checks', async () => {
    await answerFoundationIncorrectly();

    expect(screen.getByText(/starting at the beginning/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /build my learning plan/i })).toHaveAttribute(
      'href',
      '/learn/english-to-french/plan',
    );
  });

  it('persists the adaptive result for the learning plan to read later', async () => {
    await answerFoundationIncorrectly();

    const saved = JSON.parse(localStorage.getItem('verbalibera_placement') ?? 'null');
    expect(saved).toMatchObject({ score: 0, total: 3, band: 'A1' });
  });

  it('restores a saved result instead of restarting the quiz', async () => {
    localStorage.setItem(
      'verbalibera_placement',
      JSON.stringify({ score: 3, total: 3, band: 'A1', startCefr: 'A1', startConceptId: 'fr-greet-politely', stretchUnlocked: false, aboveContent: false }),
    );
    render(<PlacementQuiz courseSlug="english-to-french" />);

    expect(await screen.findByText(/starting at the beginning/i)).toBeInTheDocument();
    expect(screen.queryByText(/placement · question 1/i)).not.toBeInTheDocument();
  });
});
