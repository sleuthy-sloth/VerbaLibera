import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlanBuilder } from '@/components/plan/PlanBuilder';
import { PlanOverview, currentWeekIndex } from '@/components/plan/PlanOverview';
import { initialCourses } from '@/features/curriculum/fixture';
import { generatePlan } from '@/features/study-plan/generate';
import type { StudyPlan } from '@/features/study-plan/types';

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

function frenchPlan(): StudyPlan {
  const concepts = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;
  return generatePlan(
    {
      courseSlug: 'english-to-french',
      startCefr: 'A1',
      startConceptId: 'fr-greet-politely',
      daysPerWeek: 5,
      minutesPerDay: 8,
      targetLevel: 'B1',
      startDate: '2026-09-07',
    },
    concepts,
  );
}

describe('PlanBuilder', () => {
  it('previews weeks live and saves the plan', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <PlanBuilder
        courseSlug="english-to-french"
        startCefr="A1"
        startConceptId="fr-greet-politely"
        onSave={onSave}
      />,
    );

    expect(screen.getByText(/plan items/i)).toBeInTheDocument();
    expect(screen.getByText(/still being authored/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/days per week/i), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: /save my plan/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0].daysPerWeek).toBe(3);
  });
});

describe('PlanOverview', () => {
  it('shows the current week, checklist, and frontier note', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <PlanOverview plan={frenchPlan()} todayIso="2026-09-07" done={{}} onToggle={onToggle} onReset={() => {}} />,
    );

    expect(screen.getByText(/week 1 of/i)).toBeInTheDocument();
    expect(screen.getByText(/items done/i)).toBeInTheDocument();
    expect(screen.getByText(/still being authored/i)).toBeInTheDocument();

    const first = screen.getAllByRole('checkbox')[0]!;
    await user.click(first);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('advances the current week from the date, not the checklist', () => {
    const concepts = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;
    const longPlan = generatePlan(
      {
        courseSlug: 'english-to-french',
        startCefr: 'A1',
        startConceptId: 'fr-greet-politely',
        daysPerWeek: 2,
        minutesPerDay: 5,
        targetLevel: 'B1',
        startDate: '2026-09-07',
      },
      concepts,
    );
    expect(longPlan.weeks.length).toBeGreaterThan(1);
    expect(currentWeekIndex(longPlan, '2026-09-07')).toBe(0);
    expect(currentWeekIndex(longPlan, '2026-09-20')).toBe(1);
    expect(currentWeekIndex(longPlan, '2026-01-01')).toBe(0);
  });
});
