'use client';

import Link from 'next/link';
import { useState } from 'react';
import { initialCourses } from '@/features/curriculum/fixture';
import type { SessionStepKind } from '@/features/session/compose-session';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import styles from './session.module.css';

type GuidedSessionProps = Readonly<{
  progress: DemoProgressSnapshot;
  courseSlug: string;
}>;

const stepNames: Record<SessionStepKind, string> = {
  REVIEW: 'Review',
  DRILL: 'Drill sprint',
  NEW_PATTERN: 'New pattern',
};

export function GuidedSession({ progress, courseSlug }: GuidedSessionProps) {
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  const sessionSteps = progress.session.filter((step) => step.courseSlug === courseSlug);
  const [stepIndex, setStepIndex] = useState(0);

  if (!course) {
    return (
      <main className={styles.unavailable}>
        <p className={styles.eyebrow}>VoxLibre preview</p>
        <h1>This course is not available in preview.</h1>
        <Link href="/">Return to your daily path</Link>
      </main>
    );
  }

  if (sessionSteps.length === 0) {
    return (
      <main className={styles.unavailable}>
        <p className={styles.eyebrow}>{course.title}</p>
        <h1>No guided steps are ready for this course preview.</h1>
        <p>Your dashboard progress has not changed.</p>
        <Link href="/">Return to your daily path</Link>
      </main>
    );
  }

  const isComplete = stepIndex >= sessionSteps.length;
  const activeStep = sessionSteps[Math.min(stepIndex, sessionSteps.length - 1)];
  const concept = course.concepts[0];
  const stepValue = isComplete ? sessionSteps.length : stepIndex + 1;
  const stepLabel = isComplete
    ? `${sessionSteps.length} of ${sessionSteps.length} steps complete`
    : `Step ${stepIndex + 1} of ${sessionSteps.length}`;

  return (
    <main className={styles.session}>
      <header className={styles.sessionHeader}>
        <Link href="/">← Daily path</Link>
        <span>8-minute preview</span>
      </header>

      <section className={styles.sessionIntro} aria-labelledby="session-heading">
        <p className={styles.eyebrow}>{course.title}</p>
        <h1 id="session-heading">Practice one useful pattern.</h1>
      </section>

      <nav className={styles.stepRail} aria-label="Session steps">
        <ol>
          {sessionSteps.map((step, index) => {
            const duplicateIndex = sessionSteps
              .slice(0, index + 1)
              .filter((candidate) => candidate.kind === step.kind).length;
            const label = step.kind === 'REVIEW' ? `Review ${duplicateIndex}` : stepNames[step.kind];
            const state = index < stepIndex ? 'complete' : index === stepIndex ? 'current' : 'upcoming';

            return (
              <li aria-current={state === 'current' ? 'step' : undefined} data-state={state} key={step.id}>
                <span aria-hidden="true">{index < stepIndex ? '✓' : index + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={styles.sessionProgress}>
        <div>
          <span>Session progress</span>
          <strong>{stepLabel}</strong>
        </div>
        <progress
          aria-label="Session progress"
          aria-valuetext={stepLabel}
          max={sessionSteps.length}
          value={stepValue}
        />
      </div>

      {isComplete ? (
        <section className={styles.completion} aria-live="polite">
          <span className={styles.completionMark} aria-hidden="true">✓</span>
          <p className={styles.eyebrow}>Path complete</p>
          <h2>Session complete</h2>
          <p>Nice work. This preview would add a gentle 20 preview XP—nothing was saved.</p>
          <Link href="/">Back to your daily path</Link>
        </section>
      ) : (
        <section className={styles.activeStep} aria-labelledby="active-step-title">
          <div className={styles.stepNumber} aria-hidden="true">
            {String(stepIndex + 1).padStart(2, '0')}
          </div>
          <div className={styles.stepBody}>
            <p className={styles.eyebrow}>{stepNames[activeStep.kind]}</p>
            <h2 id="active-step-title">
              {activeStep.kind === 'NEW_PATTERN' ? concept.title : concept.assessmentCriteria}
            </h2>
            <p className={styles.prompt}>
              {activeStep.kind === 'DRILL' ? concept.drills[0].prompt : concept.explanation}
            </p>
            <div className={styles.audioNotice} role="note">
              <strong>Transcript preview</strong>
              <p>Audio isn’t included in this preview yet. Use the transcript below for this step.</p>
              <blockquote>{concept.audioSegments[1].transcript}</blockquote>
            </div>
            <button onClick={() => setStepIndex((current) => Math.min(current + 1, sessionSteps.length))} type="button">
              Continue
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
