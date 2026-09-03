import type { SessionStep } from '@/features/session/compose-session';
export type DemoProgressSnapshot = Readonly<{
  selectedCourseSlug: string;
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
  contentVersion: string | null;
}>;
