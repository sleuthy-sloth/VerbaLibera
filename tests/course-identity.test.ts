import { describe, expect, it } from 'vitest';
import { initialCourses } from '@/features/curriculum/fixture';
import catalog from '@/features/course-pack/catalog.json';
import {
  courseIdentityFor,
  courseUniverse,
  legacyCourseSlug,
  packSlugFor,
} from '@/features/course-pack/course-identity';
import { foundationCatalog, foundationLanguage, foundationStartHref } from '@/features/course-pack/navigation';
import { demoProgress, blankDemoProgress } from '@/features/progress/demo-progress';

/**
 * The two course identity systems, checked against each other.
 *
 * The app stores course names in two shapes and both have to keep working: the
 * pack slug (`french`), which the catalogue, the banners and the course pages
 * are keyed by, and the travel fixture's slug (`english-to-french`), which is
 * what learners already have in `localStorage` and what the guided sessions,
 * placement quizzes and study plans are built on.
 *
 * The dashboard used to read the travel fixture as its course universe, which is
 * why German — a pack with a course page and a catalogue entry — never appeared
 * in the switcher or the welcome flow. The universe is the catalogue now. These
 * cases are what keeps the two from drifting apart again.
 */

describe('course identity', () => {
  it('names the same courses as the generated catalogue, in the same order', () => {
    // The failure this whole change exists to fix, in one assertion: a course
    // with a pack is a course a learner can choose.
    expect(courseUniverse.map((entry) => entry.slug)).toEqual(catalog.map((entry) => entry.slug));
    expect(foundationCatalog).toBe(courseUniverse);
    expect(courseUniverse.map((entry) => entry.slug)).toEqual([
      'french',
      'german',
      'italian',
      'portuguese',
      'spanish',
    ]);
  });

  it('is the list the dashboard actually ships', () => {
    // Not just the module's own claim: this is what the switcher and the welcome
    // flow render, for a returning learner and for a blank one.
    expect(demoProgress.courses.map((course) => course.slug)).toEqual(courseUniverse.map((entry) => entry.slug));
    expect(blankDemoProgress.courses.map((course) => course.slug)).toEqual(courseUniverse.map((entry) => entry.slug));
    expect(demoProgress.selectedCourseSlug).toBe('french');
  });

  it('maps every fixture course onto a real pack, and says which course has none', () => {
    const mapped = initialCourses.map((course) => ({
      travel: course.slug,
      pack: packSlugFor(course.slug),
    }));
    // Every travel course resolves, so the four guided sessions stay reachable.
    expect(mapped.every((entry) => entry.pack !== undefined)).toBe(true);
    expect(mapped.map((entry) => entry.pack)).toEqual(['french', 'italian', 'spanish', 'portuguese']);
    // And the round trip holds in both directions.
    for (const { travel, pack } of mapped) {
      expect(legacyCourseSlug(pack!)).toBe(travel);
      expect(packSlugFor(legacyCourseSlug(pack!))).toBe(pack);
    }
    // German is the one course with a pack and no travel fixture, which is why
    // it has no guided session and no placement quiz.
    expect(initialCourses.some((course) => course.slug === legacyCourseSlug('german'))).toBe(false);
  });

  it('accepts either form and refuses anything else', () => {
    expect(packSlugFor('french')).toBe('french');
    expect(packSlugFor('english-to-french')).toBe('french');
    expect(packSlugFor('german')).toBe('german');
    expect(packSlugFor('GERMAN')).toBeUndefined();
    expect(packSlugFor('english-to-klingon')).toBeUndefined();
    expect(packSlugFor('')).toBeUndefined();
    expect(packSlugFor(null)).toBeUndefined();
    expect(packSlugFor(undefined)).toBeUndefined();
    // `english` is a language, not a course with a pack.
    expect(packSlugFor('english')).toBeUndefined();
  });

  it('resolves the navigation helpers for both forms', () => {
    for (const slug of ['german', 'english-to-german']) {
      expect(foundationLanguage(slug)).toBe('german');
      expect(foundationStartHref(slug)).toBe('/courses/german?start=1');
      expect(courseIdentityFor(slug)?.title).toBe('German foundations');
    }
    expect(foundationStartHref('english-to-klingon')).toBe('/dashboard');
    expect(courseIdentityFor('klingon')).toBeUndefined();
  });

  it('carries the unit label and the level each course may claim', () => {
    for (const entry of courseUniverse) {
      expect(entry.unitLabel).toMatch(/^Unit 1: \S/);
    }
    // The packs that author CEFR tags claim A1 in the catalogue; the two that
    // predate the field claim nothing there, and the switcher falls back to the
    // fixture's own concept levels for them.
    expect(courseIdentityFor('german')?.authoredCefrLevel).toBe('A1');
    expect(courseIdentityFor('spanish')?.authoredCefrLevel).toBe('A1');
    expect(courseIdentityFor('french')?.authoredCefrLevel).toBeNull();
    expect(courseIdentityFor('italian')?.authoredCefrLevel).toBeNull();
  });
});
