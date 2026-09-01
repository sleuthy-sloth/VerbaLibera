'use client';

import { useState } from 'react';
import { useDemoProgress } from '@/features/progress/use-demo-progress';
import { DailyPathDashboard } from './DailyPathDashboard';
import styles from './dashboard.module.css';

export function DashboardDataBoundary({ requestedCourseSlug }: Readonly<{ requestedCourseSlug?: string }>) {
  const progressQuery = useDemoProgress();
  const [retryRequested, setRetryRequested] = useState(false);
  const retryIsActive = retryRequested && progressQuery.isFetching;

  if (progressQuery.isPending && !retryRequested) {
    return (
      <main className={`${styles.dashboard} ${styles.focusSurface} ${styles.loadingShell}`} aria-busy="true">
        <div className={styles.loadingBrand}>VoxLibre</div>
        <div className={styles.loadingSignal} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p role="status">Preparing your practice path…</p>
      </main>
    );
  }

  if (progressQuery.isError || !progressQuery.data) {
    return (
      <main
        aria-busy={retryIsActive}
        className={`${styles.dashboard} ${styles.focusSurface} ${styles.errorShell}`}
      >
        <div className={styles.errorMessage} role="alert">
          <p className={styles.eyebrow}>VoxLibre preview</p>
          <h1>Unable to load your practice path.</h1>
          <p>Your preview progress is still safe. Try the read-only snapshot again.</p>
        </div>
        {retryIsActive ? (
          <p role="status">Trying to load your practice path again…</p>
        ) : null}
        <button
          disabled={retryIsActive}
          onClick={() => {
            setRetryRequested(true);
            void progressQuery.refetch();
          }}
          type="button"
        >
          {retryIsActive ? 'Trying again…' : 'Try again'}
        </button>
      </main>
    );
  }

  return (
    <DailyPathDashboard
      progress={progressQuery.data}
      requestedCourseSlug={requestedCourseSlug}
    />
  );
}
