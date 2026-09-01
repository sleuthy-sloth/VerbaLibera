'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AudioPlayer, type AudioSegment } from '@/components/audio/AudioPlayer';
import { hasUnavailableAudio } from '@/components/audio/audio-availability';
import { initialCourses } from '@/features/curriculum/fixture';
import type { SessionStepKind } from '@/features/session/compose-session';
import { resolveSessionContent } from '@/features/session/resolve-session-content';
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

function UnavailableStep({ courseTitle, dashboardHref }: Readonly<{ courseTitle: string; dashboardHref: string }>) {
  return (
    <main className={styles.unavailable}>
      <p className={styles.eyebrow}>{courseTitle}</p>
      <h1>This lesson step is not available in preview.</h1>
      <p>Nothing was saved. Return to your daily path to choose another preview session.</p>
      <Link href={dashboardHref}>Return to your daily path</Link>
    </main>
  );
}

export function GuidedSession({ progress, courseSlug }: GuidedSessionProps) {
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  const sessionSteps = progress.session.filter((step) => step.courseSlug === courseSlug);
  const [stepIndex, setStepIndex] = useState(0);
  const [isModelRevealed, setIsModelRevealed] = useState(false);
  const [isSelfChecked, setIsSelfChecked] = useState(false);
  const shouldMoveActionFocus = useRef(false);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const completionActionRef = useRef<HTMLAnchorElement>(null);
  const isComplete = stepIndex >= sessionSteps.length;

  useEffect(() => {
    if (!shouldMoveActionFocus.current) return;

    if (isComplete) {
      completionActionRef.current?.focus();
    } else {
      primaryActionRef.current?.focus();
    }
    shouldMoveActionFocus.current = false;
  }, [isComplete, isModelRevealed, isSelfChecked, stepIndex]);

  if (!course) {
    return (
      <main className={styles.unavailable}>
        <p className={styles.eyebrow}>VoxLibre preview</p>
        <h1>This course is not available in preview.</h1>
        <Link href="/">Return to your daily path</Link>
      </main>
    );
  }

  const dashboardHref = `/?course=${encodeURIComponent(course.slug)}`;

  if (sessionSteps.length === 0) {
    return (
      <main className={styles.unavailable}>
        <p className={styles.eyebrow}>{course.title}</p>
        <h1>No guided steps are ready for this course preview.</h1>
        <p>Your dashboard progress has not changed.</p>
        <Link href={dashboardHref}>Return to your daily path</Link>
      </main>
    );
  }

  const activeStep = sessionSteps[Math.min(stepIndex, sessionSteps.length - 1)];
  const resolved = isComplete
    ? null
    : resolveSessionContent(courseSlug, activeStep.contentId, activeStep.kind === 'DRILL' ? activeStep.drillId : undefined);

  if (!isComplete && !resolved) {
    return <UnavailableStep courseTitle={course.title} dashboardHref={dashboardHref} />;
  }

  const activeContent = resolved!;
  const activeAudioSegments: readonly AudioSegment[] = resolved?.concept.audioSegments.map((segment) => ({
    id: segment.id,
    url: segment.audioUrl,
    type: segment.type.toLowerCase() as AudioSegment['type'],
    pauseAfter: segment.pauseAfter,
    transcript: segment.transcript,
  })) ?? [];
  const hasPlayableAudio = activeAudioSegments.length > 0 && !hasUnavailableAudio(activeAudioSegments);
  const stepValue = isComplete ? sessionSteps.length : stepIndex + 1;
  const stepLabel = isComplete
    ? `${sessionSteps.length} of ${sessionSteps.length} steps complete`
    : `Step ${stepIndex + 1} of ${sessionSteps.length}`;
  const advanceStep = () => {
    shouldMoveActionFocus.current = true;
    setIsModelRevealed(false);
    setIsSelfChecked(false);
    setStepIndex((current) => Math.min(current + 1, sessionSteps.length));
  };
  const revealModel = () => {
    shouldMoveActionFocus.current = true;
    setIsModelRevealed(true);
  };
  const confirmSelfCheck = () => {
    shouldMoveActionFocus.current = true;
    setIsSelfChecked(true);
  };

  return (
    <main className={styles.session}>
      <header className={styles.sessionHeader}>
        <Link href={dashboardHref}>← Daily path</Link>
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

      {isComplete ? (
        <section className={styles.completion} aria-live="polite">
          <span className={styles.completionMark} aria-hidden="true">✓</span>
          <p className={styles.eyebrow}>Path complete</p>
          <h2>Session complete</h2>
          <p>Nice work. This preview would add a gentle 20 preview XP—nothing was saved.</p>
          <Link href={dashboardHref} ref={completionActionRef}>Back to your daily path</Link>
        </section>
      ) : (
        <section className={styles.activeStep} aria-labelledby="active-step-title">
          <aside className={styles.stepContext} aria-label="Lesson context">
            <div className={styles.stepNumber} aria-hidden="true">
              {String(stepIndex + 1).padStart(2, '0')}
            </div>
            <div>
              <p className={styles.eyebrow}>Scenario</p>
              <p className={styles.scenario}>{activeContent.concept.scenario}</p>
            </div>
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
          </aside>
          <div className={styles.stepBody}>
            <p className={styles.eyebrow}>{stepNames[activeStep.kind]}</p>
            <h2 id="active-step-title">{activeContent.concept.title}</h2>
            <p className={styles.notice}>{activeContent.concept.notice}</p>
            {hasPlayableAudio ? (
              <div className={styles.audioPlayer}>
                <AudioPlayer segments={activeAudioSegments} />
              </div>
            ) : (
              <div className={styles.audioNotice} role="note">
                <strong>Audio unavailable</strong>
                <p>Audio isn’t included in this preview yet. This step uses authored text only.</p>
              </div>
            )}
            {activeStep.kind === 'NEW_PATTERN' ? (
              <>
                <p className={styles.prompt}>{activeContent.concept.modelDialogue.prompt}</p>
                <div className={styles.modelDialogue}>
                  <span>Model answer</span>
                  <strong>{activeContent.concept.modelDialogue.answer}</strong>
                </div>
                <div className={styles.actionDock}>
                  <button onClick={advanceStep} ref={primaryActionRef} type="button">
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : isSelfChecked ? (
              <>
                <p className={styles.status} aria-live="polite">
                  This is a preview—nothing was saved. Continue whenever you are ready.
                </p>
                <div className={styles.actionDock}>
                  <button onClick={advanceStep} ref={primaryActionRef} type="button">
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : isModelRevealed ? (
              <>
                <p className={styles.prompt}>{activeStep.kind === 'DRILL' ? activeContent.drill?.prompt : activeContent.concept.modelDialogue.prompt}</p>
                <div className={styles.modelDialogue}>
                  <span>Model answer</span>
                  <strong>{activeStep.kind === 'DRILL' ? activeContent.drill?.recallTarget : activeContent.concept.modelDialogue.answer}</strong>
                </div>
                <p className={styles.status} aria-live="polite">Model answer revealed. Compare it with your own response.</p>
                <div className={styles.actionDock}>
                  <button onClick={confirmSelfCheck} ref={primaryActionRef} type="button">I checked my answer</button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.prompt}>{activeStep.kind === 'DRILL' ? activeContent.drill?.prompt : activeContent.concept.modelDialogue.prompt}</p>
                <div className={styles.actionDock}>
                  <button onClick={revealModel} ref={primaryActionRef} type="button">Reveal model answer</button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
