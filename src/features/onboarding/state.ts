'use client';

import type { CourseFixture } from '@/features/curriculum/types';
import { initialCourses } from '@/features/curriculum/fixture';
import { foundationCatalogEntry, foundationStartHref } from '@/features/course-pack/navigation';
import {
  legacyCourseSlug,
  packSlugFor,
} from '@/features/course-pack/course-identity';
import { hasAuthoredPlacement } from '@/features/placement/items';
import { hasFirstWin } from '@/features/onboarding/first-win';

export type OnboardingStatus = 'unseen' | 'welcome-in-progress' | 'completed';
/** What the learner asked for. `preview` is the truthful alternative to a placement quiz. */
export type EntryIntent = 'beginner' | 'placement' | 'preview';

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
  /** True only when an authored placement set exists for this language. */
  placement: boolean;
}>;

/** The shape both the travel-fixture courses and the dashboard snapshot provide. */
export type LanguageCourse = Readonly<{ slug: string; title: string }>;

const ONBOARDING_STORAGE_KEY = 'verbalibera_onboarding:v1';
const SELECTED_COURSE_STORAGE_KEY = 'verbalibera_course';

const FLAG_BY_LANGUAGE: Record<string, string> = {
  french: '🇫🇷',
  italian: '🇮🇹',
  spanish: '🇪🇸',
  portuguese: '🇵🇹',
  german: '🇩🇪',
};

/**
 * Session-only mirror. Safari private mode and denied-storage configurations
 * throw on every `localStorage` access; onboarding must still be finishable in
 * that session, and the honest consequence is that the choice does not survive
 * a reload. `readOnboardingOutcome` reports that case so the UI can say so
 * instead of silently re-asking.
 */
const memory = new Map<string, string>();

function readKey(key: string): string | null {
  // Never touch the shared module state on the server: it would leak between
  // requests.
  if (typeof window === 'undefined') return null;
  try {
    // The mirror is consulted ONLY when storage access throws. Reading it as a
    // fallback for a missing key would resurrect entries the learner cleared
    // from site data.
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeKey(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Denied or full storage: the session mirror is the whole record, and it is
    // only ever populated here — mirroring successful writes would let a stale
    // copy outlive data the learner cleared.
    memory.set(key, value);
  }
}

export function isOnboardingState(value: unknown): value is OnboardingState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (typeof candidate.courseSlug !== 'string' || !candidate.courseSlug) return false;
  if (candidate.status !== 'unseen' && candidate.status !== 'welcome-in-progress' && candidate.status !== 'completed') return false;
  if (
    candidate.entryIntent !== undefined &&
    candidate.entryIntent !== 'beginner' &&
    candidate.entryIntent !== 'placement' &&
    candidate.entryIntent !== 'preview'
  )
    return false;
  return true;
}

/** Why a stored record was not used, so the caller can be honest about it. */
export type OnboardingOutcome =
  | Readonly<{ kind: 'unseen' }>
  | Readonly<{ kind: 'invalid' }>
  | Readonly<{ kind: 'stored'; state: OnboardingState }>;

export function readOnboardingOutcome(courses: readonly LanguageCourse[]): OnboardingOutcome {
  const raw = readKey(ONBOARDING_STORAGE_KEY);
  if (raw === null) return { kind: 'unseen' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'invalid' };
  }
  if (!isOnboardingState(parsed)) return { kind: 'invalid' };
  // A record naming a course that no longer exists is stale, not trusted. The
  // course universe moved to pack slugs, so a record written before that holds
  // `english-to-french`: it still names a real course, and it is normalised
  // rather than declared stale. Treating it as stale would send every existing
  // learner back to the language step, which is the behaviour this check exists
  // to prevent — the honest read is that they chose French.
  const stored = packSlugFor(parsed.courseSlug);
  if (!stored) return { kind: 'invalid' };
  if (!courses.some((course) => packSlugFor(course.slug) === stored)) return { kind: 'invalid' };
  return { kind: 'stored', state: { ...parsed, courseSlug: stored } };
}

export function readOnboardingState(courses: readonly LanguageCourse[]): OnboardingState | null {
  const outcome = readOnboardingOutcome(courses);
  return outcome.kind === 'stored' ? outcome.state : null;
}

export function saveOnboardingState(state: OnboardingState): void {
  writeKey(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
}

/**
 * The completion transition. Decision → entry is written here and nowhere else,
 * so "we started the welcome" can never be mistaken for "we finished it".
 */
export function completeOnboarding(courseSlug: string, entryIntent: EntryIntent): OnboardingState {
  const state: OnboardingState = { version: 1, courseSlug, status: 'completed', entryIntent };
  saveOnboardingState(state);
  return state;
}

/**
 * Which screen a returning learner resumes on. `null` means onboarding is
 * finished and the flow must not open again.
 *
 * - `welcome-in-progress` with the beginner path recorded resumes inside the
 *   first-win sequence (roadmap 1B) — only where one is authored, so a language
 *   without a sequence falls back to the starting-point screen rather than to a
 *   screen that would render empty.
 * - `welcome-in-progress` on its own means the language was chosen and the
 *   decision not yet made, so the starting-point screen is where they left off.
 */
export type OnboardingScreen = 'language' | 'choice' | 'first-win';

export function onboardingResumeScreen(state: OnboardingState | null): OnboardingScreen | null {
  if (!state || state.status === 'completed') return null;
  if (state.status === 'welcome-in-progress') {
    if (state.entryIntent === 'beginner' && hasFirstWin(state.courseSlug)) return 'first-win';
    return 'choice';
  }
  return 'language';
}

/**
 * Records the beginner path being under way, before the first-win sequence has
 * finished. Still not a completion: only `completeOnboarding` writes that.
 */
export function beginFirstWin(courseSlug: string): OnboardingState {
  const state: OnboardingState = {
    version: 1,
    courseSlug,
    status: 'welcome-in-progress',
    entryIntent: 'beginner',
  };
  saveOnboardingState(state);
  return state;
}

export function setSelectedCourse(courseSlug: string): void {
  if (!courseSlug) return;
  writeKey(SELECTED_COURSE_STORAGE_KEY, courseSlug);
}

export function onboardingDestination(state: OnboardingState): string {
  const language = foundationCatalogEntry(state.courseSlug);
  if (state.entryIntent === 'placement') {
    // Only an authored assessment can place someone. Without one, the flow must
    // not hand a learner a quiz whose result cannot mean anything.
    // The placement route and its authored questions live on the travel
    // fixture's slug, so the canonical slug is mapped back for the link.
    if (hasAuthoredPlacement(state.courseSlug)) {
      return `/learn/${legacyCourseSlug(packSlugFor(state.courseSlug) ?? '')}/placement`;
    }
    return language ? `/courses/${language.slug}` : '/dashboard';
  }
  if (state.entryIntent === 'preview') {
    return language ? `/courses/${language.slug}` : '/dashboard';
  }
  return foundationStartHref(state.courseSlug);
}

function languageCodeFor(courseSlug: string): string {
  return packSlugFor(courseSlug) ?? '';
}

/**
 * One label per course, derived from the foundation catalog rather than from a
 * hardcoded language list. A course only claims a structured syllabus when the
 * pack has one; the label never claims a completed CEFR level.
 */
function availabilityFor(courseSlug: string): string {
  const entry = foundationCatalogEntry(courseSlug);
  if (!entry) return 'Course preview';
  return entry.lessons >= 20
    ? `Structured A1 foundations · ${entry.lessons} lessons`
    : `First words and everyday basics · ${entry.lessons} lessons`;
}

function benefitFor(courseSlug: string, name: string): string {
  const language = languageCodeFor(courseSlug);
  const placement = hasAuthoredPlacement(courseSlug)
    ? ' Start from the beginning or place yourself with a short quiz.'
    : ' Start from the beginning, or look around the course first.';
  return `Learn ${name} greetings and first phrases through worked examples.${placement}`;
}

export function onboardingLanguages(courses: readonly LanguageCourse[]): OnboardingLanguage[] {
  return courses.map((course) => {
    const language = languageCodeFor(course.slug);
    const name = course.title
      .replace(/^English to /, '')
      .replace(/: A1 patterns$/, '')
      .replace(/ foundations$/, '');
    return {
      slug: course.slug,
      name,
      flag: FLAG_BY_LANGUAGE[language] ?? '🌐',
      availability: availabilityFor(course.slug),
      benefit: benefitFor(course.slug, name),
      placement: hasAuthoredPlacement(course.slug),
    };
  });
}

export function resolvedCourseSlug(progressCourseSlug: string | undefined, courses: readonly CourseFixture[]): string {
  // Both slug forms resolve, and the answer is the canonical one. Unused by the
  // app today; it keeps the same rule so it cannot disagree if it is wired up.
  for (const candidate of [progressCourseSlug, readKey(SELECTED_COURSE_STORAGE_KEY) ?? undefined]) {
    const stored = packSlugFor(candidate);
    if (stored && courses.some((course) => packSlugFor(course.slug) === stored)) return stored;
  }
  return courses[0]?.slug ?? '';
}

export { initialCourses };
