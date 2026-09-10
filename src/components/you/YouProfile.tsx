'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDemoProgress } from '@/features/progress/use-demo-progress';
import { initialCourses } from '@/features/curriculum/fixture';
import { langCodeFor } from '@/features/course-pack/language-code';
import { csrfHeaders } from '@/lib/auth/cookies';
import styles from './you.module.css';

type A11yPrefs = Readonly<{ largeText: boolean; reduceMotion: boolean }>;
const A11Y_KEY = 'verbalibera_a11y';
const DEFAULT_A11Y: A11yPrefs = { largeText: false, reduceMotion: false };

function readA11yPrefs(): A11yPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(A11Y_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      return {
        largeText: raw.largeText === true,
        reduceMotion: raw.reduceMotion === true,
      };
    }
  } catch {}
  return DEFAULT_A11Y;
}

function applyA11yPrefs(prefs: A11yPrefs): void {
  try {
    localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
    const root = document.documentElement;
    if (prefs.largeText) root.dataset.textSize = 'large';
    else delete root.dataset.textSize;
    if (prefs.reduceMotion) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
  } catch {}
}

/**
 * Phrases the learner has actually met, derived from curriculum content rather
 * than counted. "Total XP" and "Streak — No streak yet, finish a session to
 * start one" used to lead this page, which contradicted the landing page's own
 * promise ("no streaks to break, no meter you're failing") and told a learner
 * nothing about the language.
 */
function sayablePhrases(
  session: readonly { courseSlug: string; contentId: string; kind: string }[],
) {
  const met = new Set(session.filter((step) => step.kind === 'NEW_PATTERN').map((step) => `${step.courseSlug}:${step.contentId}`));
  if (met.size === 0) return [];
  const phrases: { key: string; courseSlug: string; answer: string; scenario: string }[] = [];
  for (const course of initialCourses) {
    for (const concept of course.concepts) {
      if (!met.has(`${course.slug}:${concept.id}`)) continue;
      phrases.push({
        key: `${course.slug}:${concept.id}`,
        courseSlug: course.slug,
        answer: concept.modelDialogue.answer,
        scenario: concept.scenario,
      });
    }
  }
  return phrases;
}

export function YouProfile() {
  const progressQuery = useDemoProgress();
  // Lazy init reads browser prefs (safe on the server: the try/catch in
  // readA11yPrefs falls back to defaults without localStorage).
  const [a11y, setA11y] = useState<A11yPrefs>(readA11yPrefs);
  const [signOutError, setSignOutError] = useState(false);

  // Applying prefs touches an external system (DOM + storage), never state.
  useEffect(() => {
    applyA11yPrefs(a11y);
  }, [a11y]);

  if (progressQuery.isPending) {
    return (
      <main id="main-content" className={styles.you}>
        <p className={styles.eyebrow}>You</p>
        <h1>Your profile</h1>
        <p role="status">Loading your profile…</p>
      </main>
    );
  }

  if (progressQuery.isError || !progressQuery.data) {
    return (
      <main id="main-content" className={styles.you}>
        <p className={styles.eyebrow}>You</p>
        <h1>Your profile</h1>
        <p role="alert">Unable to load your profile. Try again.</p>
        <button type="button" className={styles.primaryAction} onClick={() => void progressQuery.refetch()}>
          Try again
        </button>
      </main>
    );
  }

  const progress = progressQuery.data;
  const isPreview = progress.isPreview !== false;
  const phrases = sayablePhrases(progress.session);

  const signOut = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: csrfHeaders() });
      if (!response.ok) throw new Error('Sign-out failed');
      // Full navigation, not router.push: this component is rendered in unit
      // tests and in the offline shell, where no app router is mounted.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/you');
    } catch {
      setSignOutError(true);
    }
  };

  const daysPractised = progress.practiceFlowDays;

  return (
    <main id="main-content" className={styles.you}>
      <p className={styles.eyebrow}>You</p>
      <h1>Your profile</h1>
      <p className={styles.previewBadge}>{isPreview ? 'Saved in this browser' : 'Saved to your account'}</p>

      <section aria-labelledby="you-say-title">
        <h2 id="you-say-title">What you can say</h2>
        {phrases.length === 0 ? (
          <p className={styles.saidEmpty}>
            Nothing yet. Finish a lesson and the pattern you learn shows up here.
          </p>
        ) : (
          <ul className={styles.saidList}>
            {phrases.slice(0, 12).map((phrase) => (
              <li key={phrase.key}>
                <span className={styles.saidPhrase} lang={langCodeFor(phrase.courseSlug)}>
                  {phrase.answer}
                </span>
                <span className={styles.saidGloss}>{phrase.scenario}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="you-stats-title">
        <h2 id="you-stats-title">Where you are</h2>
        <dl className={styles.metrics}>
          <div>
            <dt className={styles.metricLabel}>Days practised</dt>
            <dd>
              <p>
                {daysPractised === 0
                  ? 'None yet — today is a good first day.'
                  : `${daysPractised} ${daysPractised === 1 ? 'day' : 'days'}`}
              </p>
            </dd>
          </div>
          <div>
            <dt className={styles.metricLabel}>Waiting for review</dt>
            <dd>
              <p>
                {progress.dueReviewCount === 0
                  ? "You're caught up — one pattern tomorrow keeps the flow."
                  : `${progress.dueReviewCount} reviews waiting`}
              </p>
            </dd>
          </div>
          <div>
            <dt className={styles.metricLabel}>Today</dt>
            <dd>
              <p>
                {progress.dailyGoal.completed} of {progress.dailyGoal.target} daily steps
              </p>
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="you-courses-title">
        <h2 id="you-courses-title">Courses</h2>
        <ul className={styles.courseList}>
          {progress.courses.map((course) => (
            <li key={course.slug}>
              <span>{course.title}</span>
              <span className={styles.courseListProgress}>{course.completionPercent}% complete</span>
            </li>
          ))}
        </ul>
        <p className={styles.sectionNote}>
          <Link href="/courses">Browse all courses</Link>
        </p>
      </section>

      <section aria-labelledby="you-a11y-title">
        <h2 id="you-a11y-title">Comfort</h2>
        <p className={styles.sectionNote}>
          Saved only in this browser, and applied everywhere in the app.
        </p>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={a11y.largeText}
            onChange={(event) => setA11y({ ...a11y, largeText: event.target.checked })}
          />
          Larger text
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={a11y.reduceMotion}
            onChange={(event) => setA11y({ ...a11y, reduceMotion: event.target.checked })}
          />
          Reduce motion
        </label>
      </section>

      <section aria-labelledby="you-account-title">
        <h2 id="you-account-title">Account</h2>
        {isPreview ? (
          <>
            <p className={styles.sectionNote}>
              What you practise here stays in this browser. Sign in to keep it on an account, so it
              follows you to another device.
            </p>
            <Link className={styles.primaryAction} href="/login">
              Keep this on my account
            </Link>
          </>
        ) : (
          <>
            <p className={styles.sectionNote}>
              Your progress is saved to your account and follows you across devices.
            </p>
            <button className={styles.primaryAction} type="button" onClick={signOut}>
              Sign out
            </button>
            {signOutError ? <p role="alert">Could not sign out. Please try again.</p> : null}
          </>
        )}
      </section>
    </main>
  );
}
