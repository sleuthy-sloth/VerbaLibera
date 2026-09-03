'use client';

import Link from 'next/link';
import styles from './dashboard.module.css';

export function FirstRunOnboarding() {
  return (
    <div className={styles.onboarding} data-testid="first-run-onboarding">
      <h2 className={styles.onboardingTitle}>Start with one useful phrase</h2>
      <p className={styles.onboardingCopy}>
        Learn one useful phrase in about 8 minutes — then come back tomorrow to keep it.
      </p>
      <Link className={styles.primaryAction} href="/learn/english-to-french">
        Start 8-minute session
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
