'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './dashboard.module.css';
import { foundationStartHref } from '@/features/course-pack/navigation';

export function FirstRunOnboarding({ courseSlug = 'english-to-french' }: { courseSlug?: string }) {
  return (
    <div className={styles.onboarding} data-testid="first-run-onboarding">
      <Image alt="" className={styles.onboardingLockup} height={592} priority
        sizes="(max-width: 375px) 80vw, 300px" src="/brand/logo-lockup.jpg" width={1792} />
      <Image alt="" className={styles.onboardingJournal} height={1024}
        sizes="(max-width: 371px) 70vw, 260px" src="/brand/empty-journal.jpg" width={1024} />
      <h2 className={styles.onboardingTitle}>Start with your first words</h2>
      <p className={styles.onboardingCopy}>
        Begin with Lesson 0: greetings and familiar words. Hear them, try them, then build your first sentence. Returning learners pick up at their next foundation lesson.
      </p>
      <Link className={styles.primaryAction} href={foundationStartHref(courseSlug)}>
        Start learning
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
