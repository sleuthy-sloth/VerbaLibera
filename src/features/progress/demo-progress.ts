import { composeDailySession } from '@/features/session/compose-session';
import type { DemoProgressSnapshot } from './types';

export const demoProgress: DemoProgressSnapshot = {
  selectedCourseSlug: 'english-to-french',
  xp: 260,
  practiceFlowDays: 4,
  dailyGoal: { completed: 4, target: 5 },
  dueReviewCount: 6,
  courses: [
    {
      slug: 'english-to-french',
      title: 'English to French: A1 patterns',
      unitLabel: 'Unit 1: Polite ordering',
      completionPercent: 80,
    },
    {
      slug: 'english-to-italian',
      title: 'English to Italian: A1 patterns',
      unitLabel: 'Unit 1: Polite ordering',
      completionPercent: 35,
    },
  ],
  session: [
    ...composeDailySession({
      courseSlug: 'english-to-french',
      dueReviews: [
        { id: 'fr-ordering-review-1', contentId: 'fr-ordering-politely' },
        { id: 'fr-ordering-review-2', contentId: 'fr-ordering-politely' },
      ],
      drillRound: { id: 'fr-find-place-drill-1', contentId: 'fr-find-place', drillId: 'fr-find-place-drill' },
      newPattern: { id: 'fr-greet-politely-1', contentId: 'fr-greet-politely' }, maxSteps: 4,
    }),
    ...composeDailySession({
      courseSlug: 'english-to-italian',
      dueReviews: [
        { id: 'it-ordering-review-1', contentId: 'it-ordering-politely' },
        { id: 'it-ordering-review-2', contentId: 'it-ordering-politely' },
      ],
      drillRound: { id: 'it-find-place-drill-1', contentId: 'it-find-place', drillId: 'it-find-place-drill' },
      newPattern: { id: 'it-greet-politely-1', contentId: 'it-greet-politely' }, maxSteps: 4,
    }),
  ],
};
