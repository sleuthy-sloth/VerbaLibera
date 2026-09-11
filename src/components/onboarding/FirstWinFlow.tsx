'use client';

import { useEffect, useRef, useState } from 'react';
import type { FirstWin, FirstWinStep } from '@/features/onboarding/first-win';
import type { EntryIntent } from '@/features/onboarding/state';
import styles from './first-win.module.css';

/**
 * The first-win sequence (roadmap 1B).
 *
 * Deliberately takes no practice store and no course environment: there is no
 * code path from here that could write an attempt, an event, or a finished
 * lesson. The recap says as much to the learner, and `tests/first-win.test.ts`
 * asserts it at the source level.
 *
 * Sound is optional in every sense. Nothing autoplays (so there is no autoplay
 * failure to handle), the single clip is the course's own model recording loaded
 * only when the learner presses play, a failed load degrades to a one-line note
 * with the transcript still on screen, and no step requires hearing anything.
 */

type Props = Readonly<{
  firstWin: FirstWin;
  /** The single completion transition stays in WelcomeFlow. */
  onFinish: (intent: EntryIntent) => void;
}>;

export function FirstWinFlow({ firstWin, onFinish }: Props) {
  const steps = firstWin.steps;
  const recapIndex = steps.length;
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  // Focus the prompt when the step changes, but never on first paint: the
  // learner arrived here by pressing a button, and moving focus again would be
  // a small theft. Same rule LessonPlayer uses for its prompts.
  const skipFocus = useRef(true);
  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  const advance = () => setIndex((current) => Math.min(current + 1, recapIndex));
  const repeat = () => {
    skipFocus.current = true;
    setIndex(0);
  };

  const step = index < recapIndex ? steps[index] : null;
  const stepLabel = `Step ${index + 1} of ${recapIndex + 1}`;

  return (
    <div className={styles.flow}>
      <div className={styles.header}>
        <p className={styles.stepCount}>{stepLabel}</p>
      </div>
      {step ? (
        <StepBody
          key={index}
          step={step}
          languageCode={firstWin.languageCode}
          headingRef={headingRef}
          onAdvance={advance}
        />
      ) : (
        <Recap firstWin={firstWin} headingRef={headingRef} onFinish={onFinish} onRepeat={repeat} />
      )}
    </div>
  );
}

function StepBody({
  step,
  languageCode,
  headingRef,
  onAdvance,
}: {
  step: FirstWinStep;
  languageCode: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAdvance: () => void;
}) {
  if (step.phase === 'recognize') {
    return (
      <RecognizeStep
        step={step}
        languageCode={languageCode}
        headingRef={headingRef}
        onAdvance={onAdvance}
      />
    );
  }
  if (step.phase === 'construct') {
    return (
      <ConstructStep
        step={step}
        languageCode={languageCode}
        headingRef={headingRef}
        onAdvance={onAdvance}
      />
    );
  }
  if (step.phase === 'say') {
    return (
      <SayStep
        step={step}
        languageCode={languageCode}
        headingRef={headingRef}
        onAdvance={onAdvance}
      />
    );
  }
  return (
    <MeetStep step={step} languageCode={languageCode} headingRef={headingRef} onAdvance={onAdvance} />
  );
}

type StepProps<T extends FirstWinStep> = {
  step: T;
  languageCode: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onAdvance: () => void;
};

function MeetStep({
  step,
  languageCode,
  headingRef,
  onAdvance,
}: StepProps<Extract<FirstWinStep, { phase: 'meet' }>>) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);

  return (
    <>
      <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
        {step.prompt}
      </h2>
      <div className={styles.card}>
        <p className={styles.phrase} lang={languageCode}>
          {step.phrase}
        </p>
        <p className={styles.meaning}>{step.meaning}</p>
        <p className={styles.copy}>{step.note}</p>
        {/* preload="none": a learner studying with the sound off never fetches
            the clip, and neither does a learner on a metered connection. */}
        <audio
          ref={audioRef}
          src={step.audioUrl}
          preload="none"
          onError={() => setAudioFailed(true)}
          data-first-win-audio
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={audioFailed}
            onClick={() => {
              void audioRef.current?.play().catch(() => setAudioFailed(true));
            }}
          >
            Play the recording
          </button>
        </div>
        {audioFailed ? (
          <p className={styles.audioNote} role="status">
            The sound did not load. Nothing here needs it — read the line below and carry on.
          </p>
        ) : null}
        <details className={styles.transcript}>
          <summary>Show the words</summary>
          <p lang={languageCode}>{step.audioTranscript}</p>
        </details>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onAdvance}>
          Continue
        </button>
      </div>
    </>
  );
}

function RecognizeStep({ step, languageCode, headingRef, onAdvance }: StepProps<Extract<FirstWinStep, { phase: 'recognize' }>>) {
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = choice === step.answer;

  return (
    <>
      <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
        {step.prompt}
      </h2>
      <fieldset className={styles.optionGroup}>
        <legend className={styles.stepCount}>Pick one</legend>
        {step.options.map((option) => (
          <label
            key={option}
            className={`${styles.option} ${choice === option ? styles.optionSelected : ''}`}
          >
            <input
              type="radio"
              name="first-win-option"
              value={option}
              checked={choice === option}
              onChange={() => {
                setChoice(option);
                setChecked(false);
              }}
            />
            <span lang={languageCode}>{option}</span>
          </label>
        ))}
      </fieldset>
      {checked ? (
        <p
          className={correct ? styles.feedback : `${styles.feedback} ${styles.feedbackWrong}`}
          role="status"
        >
          {correct ? step.why : step.wrongNote}
        </p>
      ) : null}
      <div className={styles.actions}>
        {/* Check first, then Continue — so a learner who gets it right on the
            first try still reads why it is right, and a wrong answer never
            advances. Changing the answer clears the verdict. */}
        {checked && correct ? (
          <button type="button" className={styles.primary} onClick={onAdvance}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={choice === null}
            onClick={() => setChecked(true)}
          >
            Check
          </button>
        )}
      </div>
    </>
  );
}

function ConstructStep({ step, languageCode, headingRef, onAdvance }: StepProps<Extract<FirstWinStep, { phase: 'construct' }>>) {
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const built = picked.join(' ');
  const correct = built === step.answer;
  const remaining = step.tokens.filter((token) => !picked.includes(token));

  return (
    <>
      <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
        {step.prompt}
      </h2>
      <div className={styles.answerLine} aria-label="Your sentence">
        {picked.length === 0 ? (
          <span className={styles.answerEmpty}>Tap the words below in order.</span>
        ) : (
          picked.map((token) => (
            <button
              key={token}
              type="button"
              className={styles.token}
              aria-label={`Remove ${token}`}
              onClick={() => {
                setPicked((current) => current.filter((candidate) => candidate !== token));
                setChecked(false);
              }}
            >
              <span lang={languageCode}>{token}</span>
            </button>
          ))
        )}
      </div>
      <div className={styles.tokenBank}>
        {remaining.map((token) => (
          <button
            key={token}
            type="button"
            className={styles.token}
            onClick={() => {
              setPicked((current) => [...current, token]);
              setChecked(false);
            }}
          >
            <span lang={languageCode}>{token}</span>
          </button>
        ))}
      </div>
      {checked ? (
        <p
          className={correct ? styles.feedback : `${styles.feedback} ${styles.feedbackWrong}`}
          role="status"
        >
          {correct ? step.why : step.wrongNote}
        </p>
      ) : null}
      <div className={styles.actions}>
        {checked && correct ? (
          <button type="button" className={styles.primary} onClick={onAdvance}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={picked.length === 0}
            onClick={() => setChecked(true)}
          >
            Check
          </button>
        )}
      </div>
    </>
  );
}

function SayStep({ step, languageCode, headingRef, onAdvance }: StepProps<Extract<FirstWinStep, { phase: 'say' }>>) {
  const [said, setSaid] = useState(false);

  return (
    <>
      <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
        {step.prompt}
      </h2>
      <div className={styles.card}>
        <p className={styles.phrase} lang={languageCode}>{step.phrase}</p>
        <p className={styles.meaning}>{step.meaning}</p>
        <p className={styles.copy}>{step.why}</p>
      </div>
      {said ? (
        <p className={styles.feedback} role="status">
          Good. That is the whole sequence — you have said it out loud in your own voice.
        </p>
      ) : null}
      <div className={styles.actions}>
        {/* No microphone API is involved: saying it out loud is the learner's
            own business, so this costs nothing, needs no permission, and cannot
            fail. Skipping is a first-class action, not a failure. */}
        {said ? (
          <button type="button" className={styles.primary} onClick={onAdvance}>
            Continue
          </button>
        ) : (
          <>
            <button type="button" className={styles.primary} onClick={() => setSaid(true)}>
              I said it out loud
            </button>
            <button type="button" className={styles.tertiary} onClick={onAdvance}>
              Skip this step
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Recap({
  firstWin,
  headingRef,
  onFinish,
  onRepeat,
}: {
  firstWin: FirstWin;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFinish: (intent: EntryIntent) => void;
  onRepeat: () => void;
}) {
  return (
    <>
      <h2 className={styles.title} ref={headingRef} tabIndex={-1}>
        {firstWin.recap.headline}
      </h2>
      <div className={styles.card}>
        <p className={styles.meaning}>{firstWin.recap.body}</p>
        <dl className={styles.recapWords}>
          {firstWin.words.map((word) => (
            <div key={word.target} className={styles.recapWord}>
              <dt lang={firstWin.languageCode}>{word.target}</dt>
              <dd>{word.meaning}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.audioNote}>{firstWin.recap.notALesson}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => onFinish('beginner')}>
          Start lesson 1
        </button>
        <button type="button" className={styles.secondary} onClick={() => onFinish('preview')}>
          Look around the course first
        </button>
        <button type="button" className={styles.tertiary} onClick={onRepeat}>
          Run through it again
        </button>
      </div>
    </>
  );
}
