'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { initialCourses } from '@/features/curriculum/fixture';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { planPosition, todayPlanItems } from '@/features/study-plan/today';
import { parseStoredPlan } from '@/features/study-plan/parse';
import type { StudyPlan } from '@/features/study-plan/types';
import { dashboardBadgeCopy, planStatusCopy, planTodayCopy } from '@/lib/progress/copy';
import { FirstRunOnboarding } from './FirstRunOnboarding';
import { WelcomeFlow } from '@/components/onboarding/WelcomeFlow';
import { readOnboardingOutcome, type OnboardingState } from '@/features/onboarding/state';
import { LanguageSwitcher } from '@/components/nav/LanguageSwitcher';
import styles from './dashboard.module.css';
import { foundationLanguage, foundationStartHref } from '@/features/course-pack/navigation';
import { hasAuthoredPlacement } from '@/features/placement/items';

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
  { label: 'Learn', detail: 'Understand the pattern with a worked example', tone: 'pattern' },
  { label: 'Practice', detail: 'Build, listen, and try it for yourself', tone: 'drill' },
  { label: 'Remember', detail: 'Recall it and plan your next review', tone: 'review' },
] as const;

type GuestPlanStatus = Readonly<{ plan: StudyPlan; done: Record<string, boolean> }>;

// Slice 3: the browser-local plan mirror (written by the plan builder) is
// the dashboard's plan source for guests. Signed-in plans surface through
// the progress snapshot session instead. Corrupt storage means no plan,
// never a broken dashboard.
function readGuestPlan(courseSlug: string): GuestPlanStatus | null {
  try {
    const saved = parseStoredPlan(JSON.parse(localStorage.getItem(`verbalibera_plan:${courseSlug}`) ?? 'null'), courseSlug);
    if (!saved) return null;
    const flags = JSON.parse(
      localStorage.getItem(`verbalibera_plan_done:${courseSlug}`) ?? 'null',
    ) as Record<string, boolean> | null;
    return { plan: saved, done: flags ?? {} };
  } catch {
    return null;
  }
}

export function DailyPathDashboard({ progress, requestedCourseSlug }: DailyPathDashboardProps) {
  const isPreview = progress.isPreview !== false;
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
  const [guestPlan, setGuestPlan] = useState<GuestPlanStatus | null>(null);
  /**
   * `loading` renders the returning-learner card, never a flash of onboarding.
   * `unseen`/`invalid` open the flow; `in-progress` resumes it; `completed`
   * never opens it again.
   */
  const [onboarding, setOnboarding] = useState<
    'loading' | 'unseen' | 'invalid' | 'in-progress' | 'completed'
  >('loading');
  // The stored record itself, so the flow resumes where the learner left off
  // instead of restarting at the language screen.
  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Deferred like the plan builder: read storage after paint so the effect
    // never sets state synchronously (cascading-render lint).
    const timer = setTimeout(() => {
      const outcome = readOnboardingOutcome(initialCourses);
      if (outcome.kind === 'stored') {
        setOnboardingState(outcome.state);
        setOnboarding(outcome.state.status === 'completed' ? 'completed' : 'in-progress');
        return;
      }
      setOnboardingState(null);
      setOnboarding(outcome.kind === 'invalid' ? 'invalid' : 'unseen');
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!isPreview || typeof window === 'undefined' || !selectedCourse) return;
    const slug = selectedCourse.slug;
    const timer = setTimeout(() => {
      setGuestPlan(readGuestPlan(slug));
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedCourse, isPreview]);
  const isBlank = progress.dueReviewCount === 0 && progress.dailyGoal.completed === 0;

  if (!selectedCourse) {
    return (
      <main id="main-content" tabIndex={-1} className={`${styles.dashboard} ${styles.focusSurface}`}>
        <p className={styles.eyebrow}>VerbaLibera</p>
        <h1>VerbaLibera</h1>
        <p>No preview courses are ready yet.</p>
      </main>
    );
  }

  const language = foundationLanguage(selectedCourse.slug);
  const languageName = language ? language[0].toUpperCase() + language.slice(1) : "";
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
  // The stored plan belongs to its own course — never show a previous
  // selection's status while the fresh read is still deferred.
  const activePlan = isPreview ? guestPlan : progress.studyPlans?.[selectedCourse.slug];
  const planSummary =
    activePlan && activePlan.plan.courseSlug === selectedCourse.slug
      ? {
        status: planStatusCopy({
          week: planPosition(activePlan.plan, activePlan.done).currentWeek,
          weekCount: planPosition(activePlan.plan, activePlan.done).weekCount,
          targetLevel: activePlan.plan.targetLevel,
        }),
        today: planTodayCopy({ count: isPreview ? todayPlanItems(activePlan.plan, activePlan.done).length : progress.session.filter(step => step.courseSlug === selectedCourse.slug && step.id.startsWith('plan-')).length }),
        frontierNote: activePlan.plan.frontier?.note ?? null,
      }
    : null;
  const hasGuidedSession =
    !!authoredCourse &&
    progress.session.some((step) => step.courseSlug === selectedCourse.slug);
  // Every course in the snapshot resolves to a foundation pack or nothing. The
  // old code showed "Session preview coming soon" here — a status message where
  // a next step belonged, with no way forward from it.
  const foundationHref = language ? foundationStartHref(selectedCourse.slug) : null;
  // An explicit ?course= deep link means the learner has already chosen, so the
  // welcome flow would be asking a question they just answered. A record left
  // mid-flow resumes; a completed one never reopens.
  const showWelcome =
    isBlank &&
    (onboarding === 'unseen' || onboarding === 'invalid' || onboarding === 'in-progress') &&
    !(requestedCourseSlug && requestedCourseIndex >= 0);

  return (
    <main id="main-content" tabIndex={-1} className={`${styles.dashboard} ${styles.focusSurface}`}>
      <header className={styles.brandHeader}>
        <Link className={styles.wordmark} href="/dashboard" aria-label="VerbaLibera — Today">
          <Image alt="" height={68} priority src="/brand/logo-mark.jpg" width={68} />
          VerbaLibera
        </Link>
        {showWelcome ? null : (
          <LanguageSwitcher currentCourse={selectedCourse.slug} courses={progress.courses} dashboard onChange={(slug) => {
            const nextIndex = progress.courses.findIndex((course) => course.slug === slug);
            if (nextIndex >= 0) setSelectedCourseIndex(nextIndex);
          }} />
        )}
        <p className={styles.previewBadge}>
          <span aria-hidden="true" />
          {dashboardBadgeCopy({ isPreview })}
        </p>
        <nav className={styles.headerNav} aria-label="Primary">
          <Link href="/dashboard">Today</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/listen">Listen</Link>
          <Link href="/you">You</Link>
        </nav>
        {isDebug && progress.contentVersion ? (
          <p data-testid="content-version-badge" className={styles.previewBadge} style={{ marginLeft: '0.5rem' }}>
            v{progress.contentVersion}
          </p>
        ) : null}
        {isPreview ? <Link className={styles.accountLink} href="/login">Keep this on my account</Link> : <Link className={styles.accountLink} href="/you">Your profile</Link>}
      </header>

      <section className={styles.intro} aria-labelledby="dashboard-title">
        <p className={styles.eyebrow}>Today</p>
        <h1 id="dashboard-title">
          <span className={styles.srOnly}>VerbaLibera — </span>
          Keep your useful phrases moving.
        </h1>
        <p className={styles.introCopy}>
          Learn how the language works, practise one useful pattern, and make it part of your
          everyday vocabulary.{' '}
          {hasAuthoredPlacement(selectedCourse.slug) ? (
            <>
              Already know some?{' '}
              <Link href={`/learn/${selectedCourse.slug}/placement`}>
                Take the 3-minute placement quiz
              </Link>.
            </>
          ) : (
            <>
              Not sure this is the right level?{' '}
              <Link href={`/courses/${language}`}>Look through the {languageName} lessons first</Link>.
            </>
          )}
        </p>
        <div className={styles.introArtwork}>
          <Image alt="" height={672} src="/brand/hero-banner.jpg" width={1584} />
        </div>
      </section>

      <div className={styles.learningPromise}>
        <span>Free to learn</span><span>Explanations before exercises</span><span>No timers or lost hearts</span>
      </div>
      {language && !showWelcome ? <section className={styles.foundationEntry} aria-label="Offline study">
        <div>
          <h2>{languageName}, from the first words</h2>
          <p>Start at the first lesson or continue where you left off. Travel sessions remain available below.</p>
        </div>
        <div>
          <Link href={`/courses/${language}#offline-download`}>Download {languageName} for offline study</Link>
        </div>
      </section> : null}
      <div className={styles.dashboardGrid}>
        <section className={styles.todayCard} aria-labelledby="today-title">
          <div className={styles.todayHeading}>
            <div>
              <p className={styles.kicker} id="today-title">{"Today's lesson"}</p>
              <p className={`${styles.kicker} ${styles.contrastTag}`}>Up next</p>
              <h2>{selectedCourse.unitLabel}</h2>
              <p className={styles.courseMeta}>{selectedCourse.title}</p>
              {nextScenario ? <p className={styles.scenario}>{nextScenario}</p> : null}
            </div>
            <p className={styles.pathTime}>About 8 min</p>
          </div>

          {planSummary ? (
            <div>
              <p className={styles.kicker}>{planSummary.status}</p>
              <p className={styles.scenario}>{planSummary.today}</p>
              {planSummary.frontierNote ? (
                <p className={styles.scenario}>{planSummary.frontierNote}</p>
              ) : null}
              <p className={styles.courseMeta}>
                <Link href={`/learn/${selectedCourse.slug}/plan`}>Review your study plan</Link>
              </p>
            </div>
          ) : null}

          {showWelcome ? (
            <WelcomeFlow
              courses={progress.courses}
              initialState={onboardingState}
              notice={
                onboarding === 'invalid'
                  ? 'We could not read a saved choice on this device, so here it is again. Choosing will replace it.'
                  : null
              }
              onComplete={(destination) => {
                // Full navigation rather than router.push: this fires once per
                // learner, and it matches how LanguageSwitcher already leaves a
                // course page. It also keeps the dashboard renderable outside
                // an app-router context (unit tests, offline shell).
                window.location.assign(destination);
              }}
            />
          ) : isBlank ? (
            <FirstRunOnboarding courseSlug={selectedCourse.slug} />
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

              {hasGuidedSession ? (
                <Link className={styles.primaryAction} href={`/learn/${selectedCourse.slug}`}>
                  Continue today&rsquo;s lesson
                  <span aria-hidden="true">→</span>
                </Link>
              ) : foundationHref ? (
                <Link className={styles.primaryAction} href={foundationHref}>
                  Open {languageName} foundations
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <p className={styles.pendingAction} role="status">
                  {selectedCourse.title} lessons are being authored
                </p>
              )}
            </>
          )}
        </section>

      </div>
    </main>
  );
}
