'use client';

import { useDemoProgress } from '@/features/progress/use-demo-progress';
import { DailyPathDashboard } from './DailyPathDashboard';
import styles from './dashboard.module.css';

export function DashboardDataBoundary() {
  const progressQuery = useDemoProgress();

  if (progressQuery.isPending) {
    return (
      <main className={`${styles.dashboard} ${styles.loadingShell}`} aria-busy="true">
        <div className={styles.loadingBrand}>VoxLibre</div>
        <div className={styles.loadingSignal} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Preparing your practice path…</p>
      </main>
    );
  }

  if (progressQuery.isError || !progressQuery.data) {
    return (
      <main className={`${styles.dashboard} ${styles.errorShell}`}>
        <p className={styles.eyebrow}>VoxLibre preview</p>
        <h1>Unable to load your practice path.</h1>
        <p>Your preview progress is still safe. Try the read-only snapshot again.</p>
        <button onClick={() => progressQuery.refetch()} type="button">
          Try again
        </button>
      </main>
    );
  }

  return <DailyPathDashboard progress={progressQuery.data} />;
}
