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
    expect(demoProgress.session.filter((step) => step.courseSlug === 'english-to-french')).toEqual([
      { id: 'fr-ordering-review-1', kind: 'REVIEW', courseSlug: 'english-to-french', contentId: 'fr-ordering-politely' },
      { id: 'fr-ordering-drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'fr-ordering-politely', drillId: 'fr-ordering-politely-drill' },
      { id: 'fr-find-place-drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'fr-find-place', drillId: 'fr-find-place-drill' },
      { id: 'fr-greet-politely-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french', contentId: 'fr-greet-politely' },
    ]);
    expect(demoProgress.session.filter((step) => step.courseSlug === 'english-to-italian')).toEqual([
      { id: 'it-ordering-review-1', kind: 'REVIEW', courseSlug: 'english-to-italian', contentId: 'it-ordering-politely' },
      { id: 'it-ordering-drill-1', kind: 'DRILL', courseSlug: 'english-to-italian', contentId: 'it-ordering-politely', drillId: 'it-ordering-politely-drill' },
      { id: 'it-find-place-drill-1', kind: 'DRILL', courseSlug: 'english-to-italian', contentId: 'it-find-place', drillId: 'it-find-place-drill' },
      { id: 'it-greet-politely-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-italian', contentId: 'it-greet-politely' },
    ]);
    expect(new Set(demoProgress.session.map((step) => step.id)).size).toBe(demoProgress.session.length);
  });
});
