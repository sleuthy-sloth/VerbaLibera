import type { CEFRLevel } from '@/features/curriculum/types';

export type PlanMode = 'teach' | 'drill' | 'review';

export type PlanItem = Readonly<{
  conceptId: string;
  mode: PlanMode;
  drillId?: string;
}>;

export type PlanWeek = Readonly<{
  weekIndex: number;
  startsOn: string;
  items: readonly PlanItem[];
}>;

export type PlanFrontier = Readonly<{
  coveredThrough: CEFRLevel;
  targetLevel: CEFRLevel;
  note: string;
}>;

export type StudyPlan = Readonly<{
  courseSlug: string;
  targetLevel: CEFRLevel;
  daysPerWeek: number;
  minutesPerDay: number;
  startDate: string;
  weeks: readonly PlanWeek[];
  frontier: PlanFrontier | null;
}>;

export type PaceInput = Readonly<{
  courseSlug: string;
  startCefr: CEFRLevel;
  startConceptId: string;
  daysPerWeek: number;
  minutesPerDay: 5 | 8 | 15;
  targetLevel: CEFRLevel;
  startDate: string;
}>;
