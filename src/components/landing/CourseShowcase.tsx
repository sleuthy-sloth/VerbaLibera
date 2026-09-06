import Image from 'next/image';
import Link from 'next/link';
import { Fragment } from 'react';
import s from './landing.module.css';

const courses = [
  { language: 'French', slug: 'french', href: '/courses/french', foundations: true, description: 'Patterns, examples, sentence drills, and spaced review — a structured place to begin.', alt: 'Paris and the Seine' },
  { language: 'Italian', slug: 'italian', href: '/courses/italian', foundations: true, description: 'Structured A1 foundations with the same method — build, vary, use, and review.', alt: 'The Colosseum and Florence' },
  { language: 'Spanish', slug: 'spanish', href: '/learn/english-to-spanish', foundations: false, description: 'Practical language for getting around, ordering, and everyday conversations.', alt: 'Sagrada Família and the Alhambra' },
  { language: 'Portuguese', slug: 'portuguese', href: '/learn/english-to-portuguese', foundations: false, description: 'Conversation material for trips and everyday scenes, in the same calm style.', alt: 'Pena Palace and Porto' },
];

export function CourseShowcase() {
  return <section id="courses" className={s.section} aria-labelledby="courses-heading"><div className={s.container}>
    <div className={`${s.sectionHead} ${s.wideHead}`}><p className={s.eyebrow}>Courses</p><h2 id="courses-heading">Start with a strong foundation.<br /> Travel with what you need.</h2><p>French and Italian offer structured A1 foundations. Spanish and Portuguese offer travel-and-conversation material — useful, and honest about its scope.</p></div>
    <div className={s.courseGrid}>{courses.map((course, i) => <Fragment key={course.slug}>
      {i === 2 && <p className={s.courseDivider}>Conversation &amp; travel material</p>}
      <article className={s.course} data-language={course.slug}>
        <div className={s.courseArt}><Image src={`/brand/courses/${course.slug}.jpg`} alt={course.alt} width={2064} height={512} sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 546px" /><span className={s.courseBadge}>{course.foundations ? 'Structured · A1' : 'Travel · conversation'}</span></div>
        <div className={s.courseBody}><h3>{course.language}</h3><p className={s.label}>{course.foundations ? 'Foundations' : 'Travel material'}</p><p>{course.description}</p><p className={s.courseMeta}><span aria-hidden="true" />{course.foundations ? 'Structured course · A1 foundations' : 'Supplemental travel & conversation'}</p><Link href={course.href} className={s.courseLink}>Explore {course.language}<span aria-hidden="true"> →</span></Link></div>
      </article>
    </Fragment>)}</div>
  </div></section>;
}
