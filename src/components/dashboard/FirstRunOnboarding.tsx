'use client';

import Image from 'next/image';
import Link from 'next/link';
import styles from './dashboard.module.css';
import { foundationStartHref } from '@/features/course-pack/navigation';

/**
 * The blank learner's dashboard block.
 *
 * The brand mark is the raster mark the rest of the app uses, at 44px, with the
 * name beside it in live text — the display face the headings already use. The
 * wide raster lockup that used to sit here had the name drawn into the image:
 * at 320px it rendered under 200px wide, so its lettering was unreadable and the
 * mark inside it read as a stray badge on an empty panel. Live text scales, is
 * announced, and is translated by the browser like any other copy.
 *
 * The journal is a supporting illustration, not the subject: at 150px it no
 * longer outweighs the heading and the paragraph it sits above.
 */
export function FirstRunOnboarding({ courseSlug = 'french' }: { courseSlug?: string }) {
  return (
    <div className={styles.onboarding} data-testid="first-run-onboarding">
      <p className={styles.onboardingBrand}>
        <Image alt="" className={styles.onboardingMark} height={1024} priority
          sizes="44px" src="/brand/logo-mark.jpg" width={1024} />
        <span className={styles.onboardingWordmark}>VerbaLibera</span>
      </p>
      <Image alt="" className={styles.onboardingJournal} height={1024}
        sizes="(max-width: 480px) 150px, 180px" src="/brand/empty-journal.jpg" width={1024} />
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
