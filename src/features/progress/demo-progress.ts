import { composeDailySession } from '@/features/session/compose-session';
import type { DemoProgressSnapshot } from './types';

export const blankDemoProgress: DemoProgressSnapshot = {
  selectedCourseSlug: 'english-to-french',
  xp: 0,
  practiceFlowDays: 0,
  dailyGoal: { completed: 0, target: 5 },
  dueReviewCount: 0,
  courses: [
    {
      slug: 'english-to-french',
      title: 'English to French: A1 patterns',
      unitLabel: 'Unit 1: Polite ordering',
      completionPercent: 0,
    },
    {
      slug: 'english-to-italian',
      title: 'English to Italian: A1 patterns',
      unitLabel: 'Unit 1: Polite ordering',
      completionPercent: 0,
    },
  ],
  session: [],
  contentVersion: null,
};

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
      dueReviews: [{ id: 'fr-ordering-review-1', contentId: 'fr-ordering-politely' }],
      drillRounds: [
        { id: 'fr-ordering-drill-1', contentId: 'fr-ordering-politely', drillId: 'fr-ordering-politely-drill' },
        { id: 'fr-find-place-drill-1', contentId: 'fr-find-place', drillId: 'fr-find-place-drill' },
      ],
      newPattern: { id: 'fr-greet-politely-1', contentId: 'fr-greet-politely' },
      maxSteps: 4,
    }),
    ...composeDailySession({
      courseSlug: 'english-to-italian',
      dueReviews: [{ id: 'it-ordering-review-1', contentId: 'it-ordering-politely' }],
      drillRounds: [
        { id: 'it-ordering-drill-1', contentId: 'it-ordering-politely', drillId: 'it-ordering-politely-drill' },
        { id: 'it-find-place-drill-1', contentId: 'it-find-place', drillId: 'it-find-place-drill' },
      ],
      newPattern: { id: 'it-greet-politely-1', contentId: 'it-greet-politely' },
      maxSteps: 4,
    }),
  ],
  contentVersion: null,
};
