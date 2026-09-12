'use client';

import { initialCourses } from '@/features/curriculum/fixture';
import {
  courseUniverse,
  legacyCourseSlug,
  packSlugFor,
} from '@/features/course-pack/course-identity';
import styles from './language-switcher.module.css';

function courseShortName(title: string): string {
  return title.replace(/^English to /, '').replace(/: A1 patterns$/, '').replace(/ foundations$/, '');
}

const FLAG_BY_LANGUAGE: Record<string, string> = {
  french: '🇫🇷', italian: '🇮🇹', spanish: '🇪🇸', portuguese: '🇵🇹',
  // German was missing, so the foundation course fell back to a globe while
  // the other four showed flags.
  german: '🇩🇪',
};

/**
 * The level a course may show, or null when nothing claims one.
 *
 * Prefer the pack's own authored tag, which the catalogue carries. A pack that
 * predates the field (French, Italian) reports none, and there the fixture's own
 * concept levels answer instead — floored, never rounded up, so a stray B1
 * stretch drill cannot promote an A1 course. A course neither source covers
 * shows no level rather than an invented one.
 */
function courseLevel(slug: string): string | null {
  const packSlug = packSlugFor(slug);
  if (!packSlug) return null;
  const authored = courseUniverse.find((entry) => entry.slug === packSlug)?.authoredCefrLevel;
  if (authored) return authored;
  const course = initialCourses.find((candidate) => candidate.slug === legacyCourseSlug(packSlug));
  const levels = course?.concepts.map((concept) => concept.cefrLevel) ?? [];
  if (levels.length === 0) return null;
  // Floor, not ceiling: B1 stretch drills don't promote an A1 course.
  if (levels.every((level) => level === 'A1')) return 'A1';
  const rank: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
  const floor = levels.map((level) => rank[level] ?? 0).sort((a, b) => a - b)[0] ?? 0;
  return Object.keys(rank).find((level) => rank[level] === floor) ?? null;
}

function courseLabel(slug: string, title: string): string {
  const language = packSlugFor(slug) ?? '';
  const flag = FLAG_BY_LANGUAGE[language] ?? '🌐';
  const level = courseLevel(slug);
  return `${flag} ${courseShortName(title)}${level ? ` · ${level}` : ''}`;
}

export function LanguageSwitcher({ currentCourse, dashboard = false, onChange, courses = courseUniverse }: Readonly<{ currentCourse?: string; dashboard?: boolean; onChange?: (courseSlug: string) => void; courses?: readonly { slug: string; title: string }[] }>) {
  // Both slug forms are accepted in, and pack slugs are what the options carry.
  // A caller that hands over its own list wins: the dashboard passes the
  // snapshot's courses, which are the same five in the same order.
  const packSlug = packSlugFor(currentCourse);
  const selected = packSlug && courses.some((course) => course.slug === packSlug)
    ? packSlug
    : courses[0]?.slug ?? '';

  const changeCourse = (courseSlug: string) => {
    if (!courseSlug) return;
    // Stored canonically: the pack slug is the identity the app now writes.
    try { localStorage.setItem('verbalibera_course', courseSlug); } catch {}
    onChange?.(courseSlug);
    if (dashboard) {
      window.history.pushState({}, '', `/dashboard?course=${encodeURIComponent(courseSlug)}`);
    } else {
      // The course's own page, which exists for every course in the universe.
      // This used to be `/learn/<slug>`, which only the four travel courses have.
      window.location.href = `/courses/${courseSlug}`;
    }
  };

  return (
    <label className={styles.control}>
      <span className={styles.label}>Learning language</span>
      <select aria-label="Learning language" value={selected} onChange={(event) => changeCourse(event.target.value)}>
        {courses.map((course) => <option key={course.slug} value={course.slug}>{courseLabel(course.slug, course.title)}</option>)}
      </select>
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </label>
  );
}
