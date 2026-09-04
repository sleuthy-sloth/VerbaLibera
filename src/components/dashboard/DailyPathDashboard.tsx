'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { initialCourses } from '@/features/curriculum/fixture';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { dashboardBadgeCopy, isPreviewMode } from '@/lib/progress/copy';
import { FirstRunOnboarding } from './FirstRunOnboarding';
import styles from './dashboard.module.css';

function useDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

type DailyPathDashboardProps = Readonly<{
  progress: DemoProgressSnapshot;
  requestedCourseSlug?: string;
}>;

const practiceSteps = [
  { label: 'Review', detail: 'Bring the phrase back to mind', tone: 'review' },
  { label: 'Drill', detail: 'Use the pattern without a prompt', tone: 'drill' },
  { label: 'Pattern', detail: 'Add one useful way to say it', tone: 'pattern' },
] as const;

export function DailyPathDashboard({ progress, requestedCourseSlug }: DailyPathDashboardProps) {
  const isPreview = isPreviewMode(null);
  const isDebug = useDebugFlag();
  const requestedCourseIndex = requestedCourseSlug
    ? progress.courses.findIndex((course) => course.slug === requestedCourseSlug)
    : -1;
  const snapshotCourseIndex = progress.courses.findIndex(
    (course) => course.slug === progress.selectedCourseSlug,
  );
  const initialCourseIndex = requestedCourseIndex >= 0
    ? requestedCourseIndex
    : Math.max(0, snapshotCourseIndex);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(initialCourseIndex);
  const selectedCourse = progress.courses[selectedCourseIndex] ?? progress.courses[0];
  const isBlank = progress.dueReviewCount === 0 && progress.dailyGoal.completed === 0;

  if (!selectedCourse) {
    return (
      <main id="main-content" tabIndex={-1} className={`${styles.dashboard} ${styles.focusSurface}`}>
        <p className={styles.eyebrow}>VerbaLibera preview</p>
        <h1>VerbaLibera</h1>
        <p>No preview courses are ready yet.</p>
      </main>
    );
  }

  const authoredCourse = initialCourses.find((course) => course.slug === selectedCourse.slug);
  const nextStep = progress.session.find(
    (step) =>
      step.courseSlug === selectedCourse.slug &&
      authoredCourse?.concepts.some((concept) => concept.id === step.contentId),
  );
  const nextConcept = authoredCourse?.concepts.find((concept) => concept.id === nextStep?.contentId)
    ?? authoredCourse?.concepts[0];
  const nextScenario = nextConcept?.scenario;

  const goalLabel = `${progress.dailyGoal.completed} of ${progress.dailyGoal.target} daily steps`;
  const hasSelectedSession =
    initialCourses.some((course) => course.slug === selectedCourse.slug) &&
    progress.session.some((step) => step.courseSlug === selectedCourse.slug);

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.dashboard} ${styles.focusSurface}`}>
      <header className={styles.brandHeader}>
        <Link className={styles.wordmark} href="/" aria-label="VerbaLibera home">
          <span aria-hidden="true">V</span>
          VerbaLibera
        </Link>
        <div aria-label="Available courses" className={styles.courseSegments} role="group">
          {progress.courses.map((course, index) => {
            const isSelected = index === selectedCourseIndex;
            const compactLabel = course.title.replace(/^English to /, '');

            return (
              <button
                aria-label={course.title}
                aria-pressed={isSelected}
                className={styles.courseSegment}
                key={course.slug}
                onClick={() => setSelectedCourseIndex(index)}
                type="button"
              >
                {compactLabel}
              </button>
            );
          })}
        </div>
        <p className={styles.previewBadge}>
          <span aria-hidden="true" />
          {dashboardBadgeCopy({ isPreview })}
        </p>
        {isDebug && progress.contentVersion ? (
          <p data-testid="content-version-badge" className={styles.previewBadge} style={{ marginLeft: '0.5rem' }}>
            v{progress.contentVersion}
          </p>
        ) : null}
      </header>

      <section className={styles.intro} aria-labelledby="dashboard-title">
        <p className={styles.eyebrow}>Today · your daily path</p>
        <h1 id="dashboard-title">
          <span className={styles.srOnly}>VerbaLibera — </span>
          Keep your useful phrases moving.
        </h1>
        <p className={styles.introCopy}>
          Review what is fading, sharpen it in a drill, then leave with one new pattern. Not
          starting from zero?{' '}
          <Link href={`/learn/${selectedCourse.slug}/placement`}>Take the 3-minute placement quiz</Link>.
        </p>
        <div className={styles.introArtwork}>
          <Image alt="" height={1024} src="/illustrations/daily-practice.png" width={1536} />
        </div>
      </section>

      <div className={styles.dashboardGrid}>
        <section className={styles.todayCard} aria-labelledby="today-title">
          <div className={styles.todayHeading}>
            <div>
              <p className={styles.kicker} id="today-title">{"Today's 8-minute path"}</p>
              <p className={`${styles.kicker} ${styles.contrastTag}`}>Up next</p>
              <h2>{selectedCourse.unitLabel}</h2>
              <p className={styles.courseMeta}>{selectedCourse.title}</p>
              {nextScenario ? <p className={styles.scenario}>{nextScenario}</p> : null}
            </div>
            <p className={styles.pathTime}>About 8 min</p>
          </div>

          {isBlank ? (
            <FirstRunOnboarding />
          ) : (
            <>
              <div className={styles.goal}>
                <div className={styles.goalLabel}>
                  <span>Daily goal</span>
                  <strong>{goalLabel}</strong>
                </div>
                <progress
                  aria-label="Daily goal"
                  aria-valuetext={goalLabel}
                  max={progress.dailyGoal.target}
                  value={Math.min(progress.dailyGoal.completed, progress.dailyGoal.target)}
                />
              </div>

              <ol className={styles.practicePath}>
                {practiceSteps.map((step, index) => (
                  <li
                    className={styles.pathStep}
                    data-state={index === 0 ? 'active' : 'pending'}
                    data-tone={step.tone}
                    key={step.label}
                  >
                    <span className={styles.stepMarker} aria-hidden="true">{index + 1}</span>
                    <div>
                      <h3>{step.label}</h3>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {hasSelectedSession ? (
                <Link className={styles.primaryAction} href={`/learn/${selectedCourse.slug}`}>
                  Continue 8-minute session
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <p className={styles.pendingAction} role="status">
                  Session preview coming soon
                </p>
              )}
            </>
          )}
        </section>

        <aside className={styles.progressPanel} aria-labelledby="progress-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Your pace</p>
              <h2 id="progress-title">Progress snapshot</h2>
            </div>
          </div>

          <dl className={styles.metrics}>
            <div>
              <dt className={styles.metricLabel}>Total XP</dt>
              <dd>{progress.xp} XP</dd>
            </div>
            <div>
              <dt className={styles.metricLabel}>Practice flow</dt>
              <dd><p>{progress.practiceFlowDays}-day practice flow</p></dd>
            </div>
            <div>
              <dt className={styles.metricLabel}>Streak</dt>
              <dd>
                <p>
                  {progress.streakDays === 0
                    ? 'No streak yet — finish a session to start one.'
                    : `${progress.streakDays}-day streak`}
                </p>
              </dd>
            </div>
            <div>
              <dt className={styles.metricLabel}>Review queue</dt>
              <dd>
                <p>
                  {progress.dueReviewCount === 0
                    ? "You're caught up — one pattern tomorrow keeps the flow."
                    : `${progress.dueReviewCount} reviews waiting`}
                </p>
              </dd>
            </div>
            {isDebug && progress.contentVersion ? (
              <div data-testid="content-version-panel">
                <dt className={styles.metricLabel}>Content version</dt>
                <dd>{progress.contentVersion}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </main>
  );
}
