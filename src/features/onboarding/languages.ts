import type { LanguageCourse, OnboardingLanguage } from './state';
import { onboardingLanguages } from './state';

/**
 * The single entry point for language presentation metadata during onboarding.
 *
 * It used to be a wrapper with no callers while `WelcomeFlow` re-implemented
 * flags, availability and benefits inline — two implementations, one of them
 * only visible when a language got added to one list and not the other.
 */
export function languagesFor(courses: readonly LanguageCourse[]): OnboardingLanguage[] {
  return onboardingLanguages(courses);
}

export type { OnboardingLanguage };
