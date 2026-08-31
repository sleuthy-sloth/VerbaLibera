import type { SessionStep } from '@/features/session/compose-session';

export type DemoProgressSnapshot = Readonly<{
  selectedCourseSlug: 'english-to-french' | 'english-to-italian';
  xp: number;
  practiceFlowDays: number;
  dailyGoal: Readonly<{ completed: number; target: number }>;
  dueReviewCount: number;
  courses: readonly Readonly<{
    slug: string;
    title: string;
    unitLabel: string;
    completionPercent: number;
  }>[];
  session: readonly SessionStep[];
}>;
