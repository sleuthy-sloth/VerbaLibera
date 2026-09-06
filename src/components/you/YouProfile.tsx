'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDemoProgress } from '@/features/progress/use-demo-progress';
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
        <button type="button" onClick={() => void progressQuery.refetch()}>Try again</button>
      </main>
    );
  }

  const progress = progressQuery.data;
  const isPreview = progress.isPreview !== false;

  const signOut = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: csrfHeaders() });
      if (!response.ok) throw new Error('Sign-out failed');
      window.location.assign('/you');
    } catch {
      setSignOutError(true);
    }
  };

  return (
    <main id="main-content" className={styles.you}>
      <p className={styles.eyebrow}>You</p>
      <h1>Your profile</h1>
      <p className={styles.previewBadge}>{isPreview ? 'Preview progress' : 'Saved to your account'}</p>

      <section aria-labelledby="you-stats-title">
        <h2 id="you-stats-title">Fun stats</h2>
        <dl className={styles.metrics}>
          <div>
            <dt className={styles.metricLabel}>Total XP</dt>
            <dd>{progress.xp} XP</dd>
          </div>
          <div>
            <dt className={styles.metricLabel}>Practice flow</dt>
            <dd>
              <p>{progress.practiceFlowDays}-day practice flow</p>
            </dd>
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
          <div>
            <dt className={styles.metricLabel}>Daily goal</dt>
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
              <span>{course.completionPercent}% complete</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="you-a11y-title">
        <h2 id="you-a11y-title">Accessibility</h2>
        <p className={styles.sectionNote}>Saved only in this browser.</p>
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
            <p>Your practice stays in this browser.</p>
            <Link className={styles.primaryAction} href="/login">
              Save your progress
            </Link>
          </>
        ) : (
          <>
            <p>Your progress is saved to your account and follows you across devices.</p>
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
