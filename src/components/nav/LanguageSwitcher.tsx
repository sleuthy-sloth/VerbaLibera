'use client';

import { initialCourses } from '@/features/curriculum/fixture';
import styles from './language-switcher.module.css';

function courseShortName(title: string): string {
  return title.replace(/^English to /, '');
}

export function LanguageSwitcher({ currentCourse, dashboard = false, onChange, courses = initialCourses }: Readonly<{ currentCourse?: string; dashboard?: boolean; onChange?: (courseSlug: string) => void; courses?: readonly { slug: string; title: string }[] }>) {
  const selected = currentCourse ?? courses[0]?.slug ?? '';

  const changeCourse = (courseSlug: string) => {
    if (!courseSlug) return;
    onChange?.(courseSlug);
    if (dashboard) {
      window.history.pushState({}, '', `/?course=${encodeURIComponent(courseSlug)}`);
    } else {
      window.location.href = `/learn/${courseSlug}`;
    }
  };

  return (
    <label className={styles.control}>
      <span className={styles.label}>Learning language</span>
      <select aria-label="Learning language" value={selected} onChange={(event) => changeCourse(event.target.value)}>
        {courses.map((course) => <option key={course.slug} value={course.slug}>{courseShortName(course.title)}</option>)}
      </select>
      <span className={styles.chevron} aria-hidden="true">⌄</span>
    </label>
  );
}
