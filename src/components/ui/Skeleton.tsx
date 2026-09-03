'use client';

import type { CSSProperties, HTMLAttributes } from 'react';
import styles from './skeleton.module.css';
import dashboardStyles from '@/components/dashboard/dashboard.module.css';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'heading' | 'kicker' | 'pill' | 'circle' | 'block' | 'line';
};

export function Skeleton({ width, height, variant, className, style, ...rest }: SkeletonProps) {
  const variantClass =
    variant === 'text'
      ? styles.skeletonText
      : variant === 'heading'
        ? styles.skeletonHeading
        : variant === 'kicker'
          ? styles.skeletonKicker
          : variant === 'pill'
            ? styles.skeletonPill
            : variant === 'circle'
              ? styles.skeletonCircle
              : variant === 'line'
                ? styles.skeletonLine
                : variant === 'block'
                  ? styles.skeletonBlock
                  : '';

  const inlineStyle: CSSProperties | undefined =
    width !== undefined || height !== undefined || style
      ? {
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
          ...style,
        }
      : style;

  return (
    <div
      aria-hidden="true"
      className={[styles.skeleton, variantClass, className].filter(Boolean).join(' ')}
      data-testid="skeleton"
      style={inlineStyle}
      {...rest}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <main
      aria-busy="true"
      className={`${dashboardStyles.dashboard} ${dashboardStyles.focusSurface} ${dashboardStyles.loadingShell}`}
      data-testid="dashboard-skeleton"
    >
      <div className={styles.dashboardSkeletonHeader} aria-hidden="true">
        <Skeleton width="7.5rem" height="2.15rem" style={{ borderRadius: '999px' }} />
        <div style={{ display: 'flex', gap: '0.35rem', overflow: 'hidden' }}>
          <Skeleton variant="pill" />
          <Skeleton variant="pill" style={{ width: '7.2rem' }} />
        </div>
        <Skeleton variant="kicker" style={{ width: '7rem' }} />
      </div>

      <div className={styles.dashboardSkeletonIntro} aria-hidden="true">
        <Skeleton variant="kicker" />
        <Skeleton variant="heading" style={{ width: '72%', height: '3.2rem' }} />
        <Skeleton variant="heading" style={{ width: '58%', height: '3.2rem' }} />
        <Skeleton variant="text" style={{ maxWidth: '610px', marginTop: '0.6rem' }} />
        <Skeleton variant="text" style={{ maxWidth: '520px', width: '74%' }} />
      </div>

      <div className={styles.dashboardSkeletonGrid} aria-hidden="true">
        <section className={styles.dashboardSkeletonToday}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'grid', gap: '0.55rem', flex: 1 }}>
              <Skeleton variant="kicker" />
              <Skeleton variant="heading" style={{ width: '68%' }} />
              <Skeleton variant="text" style={{ width: '44%' }} />
              <Skeleton variant="text" style={{ width: '82%' }} />
            </div>
            <Skeleton variant="kicker" style={{ width: '4.2rem', flex: '0 0 auto' }} />
          </div>

          <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Skeleton variant="text" style={{ width: '5.5rem', height: '0.78rem' }} />
              <Skeleton variant="text" style={{ width: '6.2rem', height: '0.78rem' }} />
            </div>
            <Skeleton height="0.55rem" style={{ borderRadius: '999px' }} />
          </div>

          <ol className={styles.dashboardSkeletonSteps}>
            {[0, 1, 2].map((index) => (
              <li key={index} className={styles.dashboardSkeletonStep}>
                <Skeleton variant="circle" />
                <div style={{ display: 'grid', gap: '0.38rem' }}>
                  <Skeleton variant="text" style={{ width: '5rem', height: '1rem' }} />
                  <Skeleton variant="text" style={{ width: '72%', height: '0.85rem' }} />
                </div>
              </li>
            ))}
          </ol>

          <Skeleton height="52px" style={{ borderRadius: 0 }} />
        </section>

        <aside className={styles.dashboardSkeletonProgress}>
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <Skeleton variant="kicker" />
            <Skeleton variant="heading" style={{ width: '78%', height: '1.55rem' }} />
          </div>
          <dl className={styles.dashboardSkeletonMetrics}>
            {[
              ['Total XP', '260 XP'],
              ['Practice flow', '4-day flow'],
              ['Review queue', '6 waiting'],
            ].map(([label]) => (
              <div key={label} className={styles.dashboardSkeletonMetricRow}>
                <Skeleton variant="text" style={{ width: '6rem', height: '0.72rem' }} />
                <Skeleton variant="text" style={{ width: '58%', height: '0.85rem' }} />
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <p role="status" aria-live="polite" className={dashboardStyles.srOnly}>
        Preparing your practice path…
      </p>
    </main>
  );
}
