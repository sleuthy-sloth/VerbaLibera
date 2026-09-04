import { initialCourses } from '@/features/curriculum/fixture';
import { generatePlan } from '@/features/study-plan/generate';
import type { PaceInput } from '@/features/study-plan/types';

const FRENCH = initialCourses.find((course) => course.slug === 'english-to-french')!.concepts;

const BASE: PaceInput = {
  courseSlug: 'english-to-french',
  startCefr: 'A1',
  startConceptId: 'fr-greet-politely',
  targetLevel: 'A2',
  daysPerWeek: 1,
  minutesPerDay: 5,
  startDate: '2026-09-07',
};

describe('generatePlan properties', () => {
  it('opens week 1 by teaching the start concept', () => {
    const plan = generatePlan(BASE, FRENCH);
    expect(plan.weeks[0]?.startsOn).toBe('2026-09-07');
    expect(plan.weeks[0]?.items[0]).toMatchObject({ conceptId: 'fr-greet-politely', mode: 'teach' });
  });

  it('spaces weeks 7 days apart across multiple weeks', () => {
    const plan = generatePlan(BASE, FRENCH);
    expect(plan.weeks.length).toBeGreaterThan(1);
    expect(plan.weeks[1]?.startsOn).toBe('2026-09-14');
  });

  it('bounds weekly items by pace (days × capped minutes)', () => {
    const plan = generatePlan({ ...BASE, daysPerWeek: 7, minutesPerDay: 15 }, FRENCH);
    for (const week of plan.weeks) {
      expect(week.items.length).toBeLessThanOrEqual(7 * 14);
    }
  });

  it('reviews only concepts taught so far', () => {
    const plan = generatePlan(BASE, FRENCH);
    const taught = new Set<string>();
    for (const week of plan.weeks) {
      for (const item of week.items) {
        if (item.mode === 'teach') taught.add(item.conceptId);
        if (item.mode === 'review') expect(taught.has(item.conceptId)).toBe(true);
      }
    }
  });

  it('teaches every concept from the start position onward', () => {
    const plan = generatePlan({ ...BASE, startConceptId: 'fr-find-place' }, FRENCH);
    const taught = new Set(
      plan.weeks.flatMap((week) => week.items).filter((item) => item.mode === 'teach').map((item) => item.conceptId),
    );
    expect(taught.has('fr-greet-politely')).toBe(false);
    expect(taught.has('fr-ordering-politely')).toBe(false);
    expect(taught.has('fr-find-place')).toBe(true);
  });

  it('uses a CLOZE stretch drill for learners placed above A1', () => {
    const plan = generatePlan({ ...BASE, startCefr: 'B1' }, FRENCH);
    expect(
      plan.weeks.flatMap((week) => week.items).some((item) => item.drillId === 'fr-ordering-politely-cloze'),
    ).toBe(true);
  });

  it('marks the frontier when the target level has no content yet', () => {
    const plan = generatePlan({ ...BASE, targetLevel: 'B2' }, FRENCH);
    expect(plan.frontier).not.toBeNull();
    expect(plan.frontier?.note).toMatch(/still being authored/i);
  });

  it('has no frontier when the target is covered', () => {
    const plan = generatePlan({ ...BASE, targetLevel: 'A1' }, FRENCH);
    expect(plan.frontier).toBeNull();
  });

  it('is deterministic for the same input', () => {
    expect(generatePlan(BASE, FRENCH)).toEqual(generatePlan(BASE, FRENCH));
  });
});
