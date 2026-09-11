import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLiveCourseData } from '@/features/curriculum/live-course-data';
import { hasAuthoredPlacement } from '@/features/placement/items';
import { tracksForCourse } from '@/features/listen/tracks';
import styles from './courses.module.css';

export const metadata: Metadata = {
  title: 'Courses',
  description:
    'Structured A1 foundations for French and Italian, plus first-words openings for German, Spanish and Portuguese.',
};

type CourseCard = {
  slug: string;
  language: string;
  href: string;
  kind: 'foundations' | 'first-words';
  blurb: string;
  alt: string;
};

/**
 * The app had no way to reach the course library from inside it: the landing
 * page's `#courses` anchor was the only door, and the bottom tabs offered
 * "Practice", which resolved to whatever course happened to be in localStorage.
 * This page is that door — a real route, in both navigations.
 */
const COURSES: CourseCard[] = [
  {
    slug: 'french',
    language: 'French',
    href: '/courses/french',
    kind: 'foundations',
    blurb: 'Greetings, être and avoir, articles, the near future, the passé composé, telling the time, the market, pharmacies and emergencies.',
    alt: 'Paris and the Seine',
  },
  {
    slug: 'italian',
    language: 'Italian',
    href: '/courses/italian',
    kind: 'foundations',
    blurb: 'Names and introductions, essere and avere, family, numbers, definite articles, aller and going places, modal requests, days and dates, weather.',
    alt: 'The Colosseum and Florence',
  },
  {
    slug: 'german',
    language: 'German',
    href: '/courses/german',
    kind: 'first-words',
    blurb: 'Greetings and the words German shares with English. A first-words opening; more units are being authored.',
    alt: '',
  },
  {
    slug: 'spanish',
    language: 'Spanish',
    href: '/courses/spanish',
    kind: 'first-words',
    blurb: 'Greetings and the Latin words you already know. A first-words opening; more units are being authored.',
    alt: 'Sagrada Família and the Alhambra',
  },
  {
    slug: 'portuguese',
    language: 'Portuguese',
    href: '/courses/portuguese',
    kind: 'first-words',
    blurb: 'Greetings and the words that come straight from Latin. A first-words opening; more units are being authored.',
    alt: 'Pena Palace and Porto',
  },
];

function CourseGrid({ courses, live }: { courses: CourseCard[]; live: Map<string, { totalLessons: number; totalSteps: number }> }) {
  return (
    <ul className={styles.grid}>
      {courses.map((course) => {
        const stats = live.get(course.slug);
        return (
          <li key={course.slug} className={styles.card}>
            <article>
              {course.alt ? (
                <Image
                  className={styles.art}
                  src={`/brand/courses/${course.slug}.jpg`}
                  alt={course.alt}
                  width={2064}
                  height={512}
                  sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 480px"
                />
              ) : (
                <div className={styles.artFallback} aria-hidden="true">
                  <span>{course.language}</span>
                </div>
              )}
              <p className={styles.kind}>
                {course.kind === 'foundations' ? 'Structured · A1 foundations' : 'First words'}
              </p>
              <h2>{course.language}</h2>
              <p className={styles.blurb}>{course.blurb}</p>
              {stats && stats.totalLessons > 0 ? (
                <p className={styles.stats}>
                  {stats.totalLessons} lessons · {stats.totalSteps} exercises
                  {tracksForCourse(course.slug).length > 0 ? ' · audio lesson' : ''}
                </p>
              ) : (
                <p className={styles.stats}>Lessons being authored</p>
              )}
              <Link className={styles.cta} href={course.href}>
                {course.kind === 'foundations' ? `Open ${course.language}` : `Start ${course.language}`}
                <span aria-hidden="true">→</span>
              </Link>
              {hasAuthoredPlacement(course.slug) ? (
                <Link className={styles.secondary} href={`/learn/english-to-${course.slug}/placement`}>
                  Already know some {course.language}? Find your starting point
                </Link>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}

export default function CoursesPage() {
  const live = new Map(getLiveCourseData().map((entry) => [entry.slug, entry]));
  const foundations = COURSES.filter((course) => course.kind === 'foundations');
  const firstWords = COURSES.filter((course) => course.kind === 'first-words');

  return (
    <main id="main-content" className={styles.page}>
      <p className={styles.eyebrow}>Courses</p>
      <h1>Pick a language. Start with one sentence.</h1>
      <p className={styles.lede}>
        Every course explains how a pattern works, shows you a worked example, then asks you to build
        something of your own. Hover over a lesson to see what it covers. Nothing here is graded and
        nothing expires.
      </p>

      <section aria-labelledby="foundations-heading">
        <h2 id="foundations-heading" className={styles.sectionTitle}>
          Structured A1 foundations
        </h2>
        <CourseGrid courses={foundations} live={live} />
      </section>

      <section aria-labelledby="first-words-heading">
        <h2 id="first-words-heading" className={styles.sectionTitle}>
          First words
        </h2>
        <CourseGrid courses={firstWords} live={live} />
      </section>

      <section aria-labelledby="not-sure" className={styles.notSure}>
        <h2 id="not-sure">Not sure where to start?</h2>
        <p>
          Open any language and start at Lesson 0. Nothing here is locked behind a payment, a
          streak, or an account, and you can change language whenever you like.
        </p>
        <p>
          <Link href="/dashboard">Back to today&rsquo;s path</Link> ·{' '}
          <Link href="/listen">Audio lessons</Link>
        </p>
      </section>
    </main>
  );
}
