'use client';

import type { CourseFixture } from '@/features/curriculum/types';
import { initialCourses } from '@/features/curriculum/fixture';
import { foundationStartHref } from '@/features/course-pack/navigation';

export type OnboardingStatus = 'unseen' | 'welcome-in-progress' | 'completed';
export type EntryIntent = 'beginner' | 'placement';

export type OnboardingState = Readonly<{
  version: 1;
  courseSlug: string;
  status: OnboardingStatus;
  entryIntent?: EntryIntent;
}>;

export type OnboardingLanguage = Readonly<{
  slug: string;
  name: string;
  flag: string;
  availability: string;
  benefit: string;
}>;

const ONBOARDING_STORAGE_KEY = 'verbalibera_onboarding:v1';
const SELECTED_COURSE_STORAGE_KEY = 'verbalibera_course';

const FLAG_BY_LANGUAGE: Record<string, string> = {
  french: '🇫🇷',
  italian: '🇮🇹',
  spanish: '🇪🇸',
  portuguese: '🇵🇹',
  german: '🇩🇪',
};

function isOnboardingState(value: unknown): value is OnboardingState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (typeof candidate.courseSlug !== 'string' || !candidate.courseSlug) return false;
  if (candidate.status !== 'unseen' && candidate.status !== 'welcome-in-progress' && candidate.status !== 'completed') return false;
  if (candidate.entryIntent !== undefined && candidate.entryIntent !== 'beginner' && candidate.entryIntent !== 'placement') return false;
  return true;
}

export function readOnboardingState(courses: readonly CourseFixture[]): OnboardingState | null {
  if (typeof window === 'undefined') return null;
  const availableSlugs = new Set(courses.map((course) => course.slug));
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isOnboardingState(parsed)) return null;
    if (!availableSlugs.has(parsed.courseSlug)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOnboardingState(state: OnboardingState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or unavailable; onboarding is best-effort only.
  }
}

export function setSelectedCourse(courseSlug: string): void {
  if (typeof window === 'undefined' || !courseSlug) return;
  try {
    localStorage.setItem(SELECTED_COURSE_STORAGE_KEY, courseSlug);
  } catch {
    // Best-effort persistence.
  }
}

export function onboardingDestination(state: OnboardingState): string {
  if (state.entryIntent === 'placement') {
    return `/learn/${state.courseSlug}/placement`;
  }
  return foundationStartHref(state.courseSlug);
}

function availabilityFor(course: CourseFixture): string {
  const language = course.slug.replace(/^english-to-/, '');
  const hasStructuredA1 = language === 'french' || language === 'italian';
  if (hasStructuredA1) return 'Structured A1 foundations';
  return 'Start with first words';
}

function benefitFor(course: CourseFixture): string {
  const language = course.slug.replace(/^english-to-/, '');
  const name = language[0].toUpperCase() + language.slice(1);
  if (language === 'french' || language === 'italian') {
    return `Learn ${name} greetings and first phrases through worked examples.`;
  }
  return `Learn ${name} greetings and first words with picture and audio drills.`;
}

export function onboardingLanguages(courses: readonly CourseFixture[]): OnboardingLanguage[] {
  return courses.map((course) => {
    const language = course.slug.replace(/^english-to-/, '');
    return {
      slug: course.slug,
      name: course.title.replace(/^English to /, '').replace(/: A1 patterns$/, ''),
      flag: FLAG_BY_LANGUAGE[language] ?? '🌐',
      availability: availabilityFor(course),
      benefit: benefitFor(course),
    };
  });
}

export function resolvedCourseSlug(progressCourseSlug: string | undefined, courses: readonly CourseFixture[]): string {
  if (progressCourseSlug && courses.some((course) => course.slug === progressCourseSlug)) {
    return progressCourseSlug;
  }
  const stored = (() => {
    if (typeof window === 'undefined') return undefined;
    try {
      return localStorage.getItem(SELECTED_COURSE_STORAGE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  if (stored && courses.some((course) => course.slug === stored)) return stored;
  return courses[0]?.slug ?? '';
}

export { initialCourses };