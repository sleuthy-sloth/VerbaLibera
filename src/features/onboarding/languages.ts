import type { CourseFixture } from '@/features/curriculum/types';
import { onboardingLanguages, type OnboardingLanguage } from './state';

/** Presentation-safe language metadata derived from current course and foundation catalog data. */
export function languagesFor(courses: readonly CourseFixture[]): OnboardingLanguage[] {
  return onboardingLanguages(courses);
}

export type { OnboardingLanguage };