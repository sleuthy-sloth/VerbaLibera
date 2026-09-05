'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AudioPlayer, type AudioSegment } from '@/components/audio/AudioPlayer';
import { hasUnavailableAudio } from '@/components/audio/audio-availability';
import { PictureChoice } from '@/components/session/PictureChoice';
import { VoiceRecorder } from '@/components/session/VoiceRecorder';
import { WordBuilder } from '@/components/session/WordBuilder';
import { ClozeBuilder } from '@/components/session/ClozeBuilder';
import { TeachingNotes } from './TeachingNotes';
import { Toast } from '@/components/ui/Toast';
import { initialCourses } from '@/features/curriculum/fixture';
import { useReviewMutation } from '@/features/progress/use-review-mutation';
import type { SessionStepKind } from '@/features/session/compose-session';
import { resolveSessionContent } from '@/features/session/resolve-session-content';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { isPreviewMode, sessionCompletionCopy } from '@/lib/progress/copy';
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
  const isPreview = isPreviewMode(null);
  return (
    <main className={styles.unavailable}>
      <p className={styles.eyebrow}>{courseTitle}</p>
      <h1>This lesson step is not available in preview.</h1>
      <p>{sessionCompletionCopy({ isPreview })} Return to your daily path to choose another preview session.</p>
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
  const [responseText, setResponseText] = useState('');
  const [verdict, setVerdict] = useState<null | { verdict: 'exact' | 'close' | 'try_again'; matchedVariant?: string; limited: boolean }>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [shouldFocusVerdict, setShouldFocusVerdict] = useState(false);
  const shouldMoveActionFocus = useRef(false);
  const mutationIds = useRef(new Map<string, string>());
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const completionActionRef = useRef<HTMLAnchorElement>(null);
  const verdictRef = useRef<HTMLDivElement>(null);
  const isComplete = stepIndex >= sessionSteps.length;
  const isPreview = progress.isPreview !== false;
  const reviewMutation = useReviewMutation();
  const [savedReviews, setSavedReviews] = useState(0);
  const [queuedReviews, setQueuedReviews] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (shouldFocusVerdict && verdictRef.current) {
      verdictRef.current.focus();
      setShouldFocusVerdict(false);
      return;
    }
    if (!shouldMoveActionFocus.current) return;

    if (isComplete) {
      completionActionRef.current?.focus();
    } else {
      primaryActionRef.current?.focus();
    }
    shouldMoveActionFocus.current = false;
  }, [isComplete, isModelRevealed, isSelfChecked, stepIndex, shouldFocusVerdict]);

  if (!course) {
    return (
      <main className={styles.unavailable}>
        <p className={styles.eyebrow}>VerbaLibera preview</p>
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
  const activeStepLabel = isComplete ? 'Complete' : stepNames[activeStep.kind];

  const advanceStep = () => {
    shouldMoveActionFocus.current = true;
    setIsModelRevealed(false);
    setIsSelfChecked(false);
    setResponseText('');
    setVerdict(null);
    setIsChecking(false);
    setShouldFocusVerdict(false);
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
  const submitReview = (reviewVerdict: 'exact' | 'close' | 'try_again') => {
    const drillItemId =
      activeStep.kind === 'DRILL' ? activeStep.drillId : `${activeStep.contentId}-listen`;
    if (isPreview) { advanceStep(); return; }
    // REVIEW steps use id as drillItemId for persistence; server validates existence
    // In preview with unavailable ids, the server will 400 but optimistic still shows
    const clientMutationId = mutationIds.current.get(activeStep.id) ?? crypto.randomUUID();
    mutationIds.current.set(activeStep.id, clientMutationId);
    reviewMutation.mutate(
      {
        drillItemId,
        verdict: isModelRevealed || isSelfChecked ? 'try_again' : reviewVerdict,
        clientMutationId,
      },
      {
        onSuccess: (data) => {
          const queued = !!(data && typeof data === 'object' && 'offline' in data && data.offline);
          if (queued) { setQueuedReviews(count => count + 1); } else { setSavedReviews(count => count + 1); }
          setToastMessage(queued ? 'Review queued on this device. It will sync when you reconnect.' : reviewVerdict === 'try_again' ? 'Saved — we’ll show this again soon.' : 'Progress saved');
          // Advance after successful save to keep flow
          advanceStep();
        },
        onError: () => {
          setToastMessage('Could not save progress. Please try again.');
        },
      },
    );
  };
  const checkAnswer = async () => {
    if (!responseText.trim()) return;
    setIsChecking(true);
    setShouldFocusVerdict(false);
    try {
      const res = await fetch('/api/answer-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseSlug,
          contentId: activeStep.contentId,
          drillId: activeStep.kind === 'DRILL' ? activeStep.drillId : undefined,
          response: responseText,
        }),
      });
      if (!res.ok) throw new Error('non-ok');
      const data = await res.json();
      setVerdict(data);

    } catch {
      setVerdict({ verdict: 'try_again', limited: true });
    } finally {
      setIsChecking(false);
      setShouldFocusVerdict(true);
    }
  };

  const learnedConceptId = sessionSteps.find(step => step.kind === 'NEW_PATTERN')?.contentId;
  const nextConcept = course.concepts[course.concepts.findIndex(concept => concept.id === learnedConceptId) + 1];
  const showReviewActions = !isComplete && activeStep.kind !== 'NEW_PATTERN';

  return (
    <main id="main-content" tabIndex={-1} className={styles.session}>
      <header className={styles.sessionHeader}>
        <Link href={dashboardHref}>← Daily path</Link>
        <span>{isPreview ? '8-minute preview' : 'Your daily practice'}</span>
      </header>

      <section className={styles.sessionIntro} aria-labelledby="session-heading">
        <p className={styles.eyebrow}>{course.title}</p>
        <h1 id="session-heading">Practice one useful pattern.</h1>
      </section>

      <div className={styles.sessionProgress} aria-live="polite">
        <div>
          <span>Session progress</span>
          <strong className={styles.stepline}>{stepLabel} · {activeStepLabel}</strong>
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
          <p>
            {isPreview
              ? `Nice work. This preview would add a gentle 20 preview XP. ${sessionCompletionCopy({ isPreview })}`
              : savedReviews > 0 ? `${savedReviews} practice results saved to your account.` : 'You completed this session without saving any practice results.'}
          </p>
          {queuedReviews > 0 ? <p>{queuedReviews} reviews are waiting on this device to sync when you reconnect.</p> : null}
          {nextConcept && learnedConceptId ? <Link className={styles.nextLesson} href={`/learn/${courseSlug}?concept=${nextConcept.id}`}>Next lesson: {nextConcept.scenario}<span aria-hidden="true">→</span></Link> : null}
          <Link href={dashboardHref} ref={completionActionRef}>Back to your daily path</Link>
        </section>
      ) : (
        <section className={styles.activeStep} aria-labelledby="active-step-title">
          <aside className={styles.stepContext} aria-label="Lesson context">
            <ol className={styles.learningStages} aria-label="Learning stages">
              {(['Learn', 'Practice', 'Recall'] as const).map((stage, index) => <li key={stage} aria-current={(activeStep.kind === 'NEW_PATTERN' ? 0 : activeStep.kind === 'DRILL' ? 1 : 2) === index ? 'step' : undefined}>{stage}</li>)}
            </ol>
            <div className={styles.stepNumber} aria-hidden="true">
              {String(stepIndex + 1).padStart(2, '0')}
            </div>
            <div>
              <p className={styles.eyebrow}>Scenario</p>
              <p className={styles.scenario}>{activeContent.concept.scenario}</p>
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
                <TeachingNotes concept={activeContent.concept} language={course.targetLanguageCode} />
                {hasPlayableAudio ? <VoiceRecorder key={`rec-${activeContent.concept.id}`} /> : null}
                <div className={styles.actionDock}>
                  <button className={styles.primaryAction} onClick={advanceStep} ref={primaryActionRef} type="button">
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : activeStep.kind === 'DRILL' ? (
              isSelfChecked ? (
                <>
                  <p className={styles.status} aria-live="polite">
                    {isPreview ? 'This is a preview—nothing was saved. Continue whenever you are ready.' : 'Use the review buttons to save your practice, or continue without saving.'}
                  </p>
                  <div className={styles.actionDock}>
                    <button
                      onClick={checkAnswer}
                      disabled={isChecking || !responseText.trim()}
                      type="button"
                    >
                      {isChecking ? 'Checking…' : 'Check my answer'}
                    </button>
                    <button className={styles.primaryAction} onClick={advanceStep} ref={primaryActionRef} type="button">
                      Continue
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : isModelRevealed ? (
                <>
                  <p className={styles.prompt}>{activeContent.drill?.prompt}</p>
                  <div className={styles.modelDialogue}>
                    <span>Model answer</span>
                    <strong>{activeContent.drill?.recallTarget}</strong>
                  </div>
                  <p className={styles.status} aria-live="polite">Model answer revealed. Compare it with your own response.</p>
                  <div className={styles.actionDock}>
                    <button
                      onClick={checkAnswer}
                      disabled={isChecking || !responseText.trim()}
                      type="button"
                    >
                      {isChecking ? 'Checking…' : 'Check my answer'}
                    </button>
                    <button onClick={confirmSelfCheck} ref={primaryActionRef} type="button">I checked my answer</button>
                    <button className={styles.primaryAction} onClick={advanceStep} type="button">
                      Continue
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {activeContent.drill?.kind === 'PICTURE_CHOICE' && activeContent.drill.choices ? (
                    <>
                      <PictureChoice
                        key={activeContent.drill.id}
                        prompt={activeContent.drill.prompt}
                        choices={activeContent.drill.choices}
                        recallTarget={activeContent.drill.recallTarget}
                        onVerdict={(pictureVerdict) => {
                          setVerdict({ verdict: pictureVerdict, limited: false });
                          setShouldFocusVerdict(false);
                        }}
                      />
                      <div className={styles.actionDock}>
                        <button className={styles.primaryAction} onClick={advanceStep} ref={primaryActionRef} type="button">
                          Continue
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                  <p className={styles.prompt}>{activeContent.drill?.prompt}</p>
                  {activeContent.drill?.kind === 'LISTEN_TYPE' ? (
                    <div className={styles.listenAudio}>
                      {activeAudioSegments
                        .filter((segment) => segment.type === 'answer')
                        .map((segment) => (
                          <audio key={segment.id} controls preload="none" src={segment.url}>
                            <track kind="captions" />
                          </audio>
                        ))}
                    </div>
                  ) : null}
                  {activeContent.drill?.kind === 'CLOZE' ? (
                    <ClozeBuilder
                      key={activeContent.drill.id}
                      template={activeContent.drill.prompt}
                      onAssemble={setResponseText}
                    />
                  ) : activeContent.drill?.kind === 'WORD_ORDER' ? (
                    <WordBuilder
                      key={activeContent.drill.id}
                      drillId={activeContent.drill.id}
                      target={activeContent.drill.recallTarget}
                      onAssemble={setResponseText}
                    />
                  ) : (
                  <div className={styles.responseSection}>
                    <label htmlFor="drill-response" className={styles.eyebrow}>Your answer</label>
                    <textarea
                      id="drill-response"
                      className={styles.responseInput}
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      rows={1}
                      disabled={isChecking}
                    />
                  </div>
                  )}
                  {verdict && (
                    <div
                      ref={verdictRef}
                      tabIndex={-1}
                      className={styles.verdictCard}
                      data-verdict={verdict.limited ? 'limited' : verdict.verdict}
                      aria-live="polite"
                      aria-atomic="true"
                      role="status"
                      aria-busy={isChecking}
                    >
                      <p>
                        {verdict.limited
                          ? 'Local checking is unavailable right now — compare with the model answer.'
                          : verdict.verdict === 'exact'
                          ? 'That matches an accepted answer.'
                          : verdict.verdict === 'close'
                          ? 'Close — compare with the accepted answer.'
                          : 'Try again, or reveal the model answer.'}
                      </p>
                      {verdict.verdict === 'close' && verdict.matchedVariant && (
                        <p className={styles.verdictHint}>{verdict.matchedVariant}</p>
                      )}
                      {!verdict.limited && <p>Checked locally. Nothing was saved.</p>}
                    </div>
                  )}
                  <div className={styles.actionDock}>
                    <button
                      onClick={checkAnswer}
                      disabled={isChecking || !responseText.trim()}
                      type="button"
                    >
                      {isChecking ? 'Checking…' : 'Check my answer'}
                    </button>
                    <button onClick={revealModel} ref={primaryActionRef} type="button" aria-label="Reveal model answer">Reveal model answer</button>
                    <button className={styles.primaryAction} onClick={advanceStep} type="button">
                      Continue
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                    </>
                  )}
                </>
              )
            ) : isSelfChecked ? (
              <>
                <p className={styles.status} aria-live="polite">
                  {isPreview ? 'This is a preview—nothing was saved. Continue whenever you are ready.' : 'Use the review buttons to save your practice, or continue without saving.'}
                </p>
                <div className={styles.actionDock}>
                  <button className={styles.primaryAction} onClick={advanceStep} ref={primaryActionRef} type="button">
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : isModelRevealed ? (
              <>
                <p className={styles.prompt}>{activeContent.concept.modelDialogue.prompt}</p>
                <div className={styles.modelDialogue}>
                  <span>Model answer</span>
                  <strong>{activeContent.concept.modelDialogue.answer}</strong>
                </div>
                <p className={styles.status} aria-live="polite">Model answer revealed. Compare it with your own response.</p>
                <div className={styles.actionDock}>
                  <button onClick={confirmSelfCheck} ref={primaryActionRef} type="button">I checked my answer</button>
                  <button className={styles.primaryAction} onClick={advanceStep} type="button">
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.prompt}>{activeContent.concept.modelDialogue.prompt}</p>
                <div className={styles.actionDock}>
                  <button onClick={revealModel} ref={primaryActionRef} type="button" aria-label="Reveal model answer">Reveal model answer</button>
                  <button className={styles.primaryAction} onClick={advanceStep} type="button">
                    Continue
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </>
            )}
            {showReviewActions ? (
              <div className={styles.actionDock} aria-label="Review actions">
                <button
                  type="button"
                  onClick={() => submitReview('exact')}
                  disabled={reviewMutation.isPending}
                  aria-label="I got it"
                >
                  {reviewMutation.isPending ? 'Saving…' : 'I got it'}
                </button>
                <button
                  type="button"
                  onClick={() => submitReview('try_again')}
                  disabled={reviewMutation.isPending}
                  aria-label="Try again"
                >
                  {reviewMutation.isPending ? 'Saving…' : 'Try again'}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      )}
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </main>
  );
}
