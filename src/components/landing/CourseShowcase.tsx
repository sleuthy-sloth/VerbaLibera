import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';
import { getLiveCourseData } from '@/features/curriculum/live-course-data';
import s from './landing.module.css';

type CourseCard = {
  language: string; slug: string; href: string; foundations: boolean;
  comingSoon?: boolean; description: string; alt: string;
};
const courses: CourseCard[] = [
  { language: 'French', slug: 'french', href: '/courses/french', foundations: true, description: 'Patterns, examples, sentence drills, and spaced review — a structured place to begin.', alt: 'Paris and the Seine' },
  { language: 'Italian', slug: 'italian', href: '/courses/italian', foundations: true, description: 'Structured A1 foundations with the same method — build, vary, use, and review.', alt: 'The Colosseum and Florence' },
  // German carried `noArt: true` long after its banner existed, so the only
  // course without a picture on the landing page was the one whose picture had
  // been generated. A missing banner is a fact about the files on disk, not a
  // flag to keep in step by hand — tests/course-banners.test.ts now holds that.
  { language: 'German', slug: 'german', href: '/courses/german', foundations: true, description: 'First words and greetings are live — a words-first opening, with more units being authored.', alt: 'A half-timbered German street with a fountain' },
  { language: 'Spanish', slug: 'spanish', href: '/courses/spanish', foundations: true, description: 'First words and greetings are live — a words-first opening, with more units being authored.', alt: 'Sagrada Família and the Alhambra' },
  { language: 'Portuguese', slug: 'portuguese', href: '/courses/portuguese', foundations: true, description: 'First words and greetings are live — a words-first opening, with more units being authored.', alt: 'Pena Palace and Porto' },
];

export function CourseShowcase() {
  const liveData = getLiveCourseData();
  const liveBySlug = Object.fromEntries(liveData.map((d) => [d.slug, d]));
  return <section id="courses" className={s.section} aria-labelledby="courses-heading"><div className={s.container}>
    <div className={`${s.sectionHead} ${s.wideHead}`}><p className={s.eyebrow}>Courses</p><h2 id="courses-heading">Start with a strong foundation.<br /> Travel with what you need.</h2><p>French and Italian offer full structured A1 foundations; German, Spanish and Portuguese open with first words, with more units being authored. Travel-and-conversation material for all five lives in the daily path.</p></div>
    <div className={s.courseGrid}>{courses.map((course) => <Fragment key={course.slug}>
      <article className={s.course} data-language={course.slug}>
        <div className={s.courseArt}>{course.comingSoon
          ? <span className={s.courseBadge}>Coming soon</span>
          : <><Image src={`/brand/courses/${course.slug}.jpg`} alt={course.alt} width={2064} height={512} sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 546px" /><span className={s.courseBadge}>{course.foundations ? 'Structured · A1' : 'Travel · conversation'}</span></>}</div>
        <div className={s.courseBody}><h3>{course.language}</h3><p className={s.label}>{course.comingSoon ? 'Foundations · coming soon' : course.foundations ? 'Foundations' : 'Travel material'}</p><p>{course.description}</p><p className={s.courseMeta}><span aria-hidden="true" />{(() => {
        const live = liveBySlug[course.slug];
        if (course.comingSoon) return 'Syllabus being authored';
        if (live && live.totalLessons > 0) {
          return `${live.totalLessons} lessons · ${live.totalSteps} exercises`;
        }
        return course.foundations ? 'Structured course · A1 foundations' : 'Supplemental travel & conversation';
      })()}</p><Link href={course.href} className={s.courseLink}>{course.comingSoon ? 'See what’s coming' : `Explore ${course.language}`}<span aria-hidden="true"> →</span></Link></div>
      </article>
    </Fragment>)}</div>
  </div></section>;
}
