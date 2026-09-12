import { courseUniverse, packSlugFor, type CourseIdentity } from './course-identity';

export type FoundationCatalogEntry = CourseIdentity;

/**
 * Generated pack facts, read from the same reports that govern content
 * decisions. Adding a field here means regenerating with `content:build`.
 *
 * This is also the app's course universe: the dashboard, the language switcher
 * and the welcome flow all read it, so a pack that exists is a course a learner
 * can choose. German used to be absent from all three because the list came from
 * the travel fixture, which has no German course.
 */
export const foundationCatalog: readonly FoundationCatalogEntry[] = courseUniverse;

/**
 * Resolve only authored foundation languages, never arbitrary stored paths.
 *
 * Accepts either slug the codebase stores (`french`, `english-to-french`) and
 * returns the canonical pack slug, or `undefined` for anything else.
 */
export function foundationLanguage(courseSlug: string): string | undefined {
  return packSlugFor(courseSlug);
}

export function foundationCatalogEntry(courseSlug: string): FoundationCatalogEntry | undefined {
  const language = packSlugFor(courseSlug);
  return language ? courseUniverse.find((entry) => entry.slug === language) : undefined;
}

export function foundationStartHref(courseSlug: string): string {
  const language = foundationLanguage(courseSlug);
  return language ? `/courses/${language}?start=1` : '/dashboard';
}
