'use client';

import { Component, Suspense, useState, type ErrorInfo, type ReactNode } from 'react';
import { useDemoProgress } from '@/features/progress/use-demo-progress';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { DailyPathDashboard } from './DailyPathDashboard';
import styles from './dashboard.module.css';

type DashboardErrorBoundaryProps = Readonly<{
  children: ReactNode;
  onReset?: () => void;
  fallback?: ReactNode;
}>;

type DashboardErrorBoundaryState = Readonly<{
  hasError: boolean;
  error: Error | null;
}>;

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    // Quiet Ink: log without surfacing PII; keep console error for observability
    void _info;
    console.error(error);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <main
          className={`${styles.dashboard} ${styles.focusSurface} ${styles.errorShell}`}
          data-testid="dashboard-error-boundary"
        >
          <div className={styles.errorMessage} role="alert">
            <p className={styles.eyebrow}>VoxLibre preview</p>
            <h1>Unable to load your practice path.</h1>
            <p>Something unexpected happened. Your preview progress is still safe. Try again.</p>
          </div>
          <button onClick={this.handleReset} type="button">
            Try again
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

function DashboardDataBoundaryInner({
  requestedCourseSlug,
}: Readonly<{ requestedCourseSlug?: string }>) {
  const progressQuery = useDemoProgress();
  const [retryRequested, setRetryRequested] = useState(false);
  const retryIsActive = retryRequested && progressQuery.isFetching;

  if (progressQuery.isPending && !retryRequested) {
    return <DashboardSkeleton />;
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
        {retryIsActive ? <p role="status">Trying to load your practice path again…</p> : null}
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

export function DashboardDataBoundary({
  requestedCourseSlug,
}: Readonly<{ requestedCourseSlug?: string }>) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <DashboardErrorBoundary
      key={resetKey}
      onReset={() => setResetKey((value) => value + 1)}
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardDataBoundaryInner requestedCourseSlug={requestedCourseSlug} />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
