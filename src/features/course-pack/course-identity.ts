import catalog from './catalog.json';

/**
 * One identity for a course, whichever system a stored value came from.
 *
 * Two slug systems are in use and both have to keep working:
 *
 * - the **pack slug** (`french`, `german`) — the course directory under
 *   `courses/`, the pack's own identity, and what the generated catalogue, the
 *   banners and the `/courses/<slug>` pages are keyed by;
 * - the **travel slug** (`english-to-french`) — the older identity of the guided
 *   drill courses in `src/features/curriculum/fixture.ts`, and what learners
 *   already have in `localStorage` (`verbalibera_course`, the onboarding record,
 *   saved study plans).
 *
 * The pack slug is the one worth keeping — the catalogue, the artwork and the
 * course pages all speak it — so it is canonical here, and the travel slug is
 * accepted on read and normalised through `packSlugFor`. That is deliberately a
 * *read* migration and not a destructive one: a learner who chose a language
 * before this change keeps their choice, and nothing rewrites their progress.
 *
 * The module has no content dependency on purpose. It is imported by the
 * navigation helpers, which server components use, so pulling the curriculum
 * fixture in here would ship it to pages that never needed it.
 */

/** The travel fixture's course slugs are all `english-to-<language>`. */
export const LEGACY_COURSE_PREFIX = 'english-to-';

/** The pack slug a course is stored under, from either form. */
export function packSlugFor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = value.startsWith(LEGACY_COURSE_PREFIX)
    ? value.slice(LEGACY_COURSE_PREFIX.length)
    : value;
  return catalog.some((entry) => entry.slug === candidate) ? candidate : undefined;
}

/** The travel fixture's slug for a pack slug, whether or not the fixture has one. */
export function legacyCourseSlug(packSlug: string): string {
  return `${LEGACY_COURSE_PREFIX}${packSlug}`;
}

export type CourseIdentity = Readonly<{
  slug: string;
  title: string;
  lessons: number;
  units: number;
  practiceActivities: number;
  /** The course's opening unit, as the Today card names it. */
  unitLabel: string;
  /** The level the pack's own lessons claim, or null when it claims none. */
  authoredCefrLevel: string | null;
}>;

/**
 * Every shipped course, in catalogue order.
 *
 * This is the app's course universe now. It used to be the four travel courses in
 * the curriculum fixture, which is why German had a pack, a course page and a
 * catalogue entry but never appeared in the dashboard's switcher or the welcome
 * flow: there was no travel fixture course for it, and inventing one would have
 * meant inventing German drill content.
 */
export const courseUniverse: readonly CourseIdentity[] = catalog;

/** The universe entry for either form of a course slug. */
export function courseIdentityFor(value: string | null | undefined): CourseIdentity | undefined {
  const slug = packSlugFor(value);
  return slug ? courseUniverse.find((entry) => entry.slug === slug) : undefined;
}
