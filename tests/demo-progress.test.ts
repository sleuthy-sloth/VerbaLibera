import { demoProgress } from '@/features/progress/demo-progress';

describe('demo progress snapshot', () => {
  it('exposes the selected learner progress and a session derived from the daily policy', () => {
    // Break caught: dashboard data drifting from the deterministic daily-session policy.
    expect(demoProgress).toMatchObject({
      selectedCourseSlug: 'english-to-french',
      xp: 260,
      practiceFlowDays: 4,
      dailyGoal: { completed: 4, target: 5 },
      dueReviewCount: 6,
    });
    expect(demoProgress.session).toEqual([
      { id: 'fr-ordering-review-1', kind: 'REVIEW', courseSlug: 'english-to-french' },
      { id: 'fr-ordering-review-2', kind: 'REVIEW', courseSlug: 'english-to-french' },
      { id: 'fr-ordering-drill-1', kind: 'DRILL', courseSlug: 'english-to-french' },
      { id: 'fr-ordering-pattern-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french' },
    ]);
  });
});
