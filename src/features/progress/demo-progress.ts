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
  session: composeDailySession({
    courseSlug: 'english-to-french',
    dueReviews: [{ id: 'fr-ordering-review-1' }, { id: 'fr-ordering-review-2' }],
    drillRound: { id: 'fr-ordering-drill-1' },
    newPattern: { id: 'fr-ordering-pattern-1' },
    maxSteps: 4,
  }),
};
