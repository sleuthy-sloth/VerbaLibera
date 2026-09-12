'use client';

import { useState } from 'react';
import {
  beginFirstWin,
  completeOnboarding,
  onboardingDestination,
  onboardingResumeScreen,
  saveOnboardingState,
  setSelectedCourse,
  type EntryIntent,
  type OnboardingScreen,
  type OnboardingState,
} from '@/features/onboarding/state';
import { firstWinFor } from '@/features/onboarding/first-win';
import { languagesFor } from '@/features/onboarding/languages';
import { packSlugFor } from '@/features/course-pack/course-identity';
import { FirstWinFlow } from './FirstWinFlow';
import styles from './welcome-flow.module.css';

export function WelcomeFlow({
  courses,
  initialState = null,
  notice,
  onComplete,
}: {
  courses: readonly { slug: string; title: string }[];
  /**
   * The stored onboarding record. A learner who chose a language and left
   * resumes on the screen they left — including inside the first-win sequence,
   * which is why `entryIntent` is written before the sequence finishes.
   */
  initialState?: OnboardingState | null;
  /** Shown when the saved choice could not be read, so the re-ask is explained. */
  notice?: string | null;
  onComplete?: (destination: string) => void;
}) {
  const languages = languagesFor(courses);
  // The stored record may hold either slug form — `readOnboardingOutcome`
  // normalises it, and a state passed straight in by a test may not. It resolves
  // to whichever form *this* list uses, so the preselection matches an option
  // whatever universe the flow was handed. A record that resolves to nothing
  // preselects nothing: `packSlugFor` refuses an unknown slug, so an unresolvable
  // stored value cannot match the first course by accident.
  const storedPackSlug = packSlugFor(initialState?.courseSlug);
  const resumedSlug = storedPackSlug
    ? courses.find((course) => packSlugFor(course.slug) === storedPackSlug)?.slug ?? null
    : null;
  const [screen, setScreen] = useState<OnboardingScreen>(
    () => onboardingResumeScreen(initialState) ?? 'language',
  );
  const [selected, setSelected] = useState<string | null>(resumedSlug);

  const selectedLanguage = languages.find((entry) => entry.slug === selected);
  const selectedFirstWin = selected ? firstWinFor(selected) : null;

  function chooseLanguage(slug: string) {
    // Selection is local until Continue: browsing languages must not rewrite
    // the course a returning learner already saved.
    setSelected(slug);
  }

  function continueLanguage() {
    if (!selected) return;
    setSelectedCourse(selected);
    // Language chosen, decision not yet made — the state that makes "resume on
    // the starting-point screen" a defined behaviour rather than a guess.
    saveOnboardingState({ version: 1, courseSlug: selected, status: 'welcome-in-progress' });
    setScreen('choice');
  }

  function backToLanguage() {
    setScreen('language');
  }

  function choose(intent: EntryIntent) {
    if (!selected) return;
    setSelectedCourse(selected);
    // Beginners with an authored sequence get the short first win before
    // anything is called finished; everyone else completes here, as before.
    if (intent === 'beginner' && firstWinFor(selected)) {
      beginFirstWin(selected);
      setScreen('first-win');
      return;
    }
    finish(intent);
  }

  function finish(intent: EntryIntent) {
    if (!selected) return;
    setSelectedCourse(selected);
    // The single completion transition. Nothing else writes 'completed'.
    const state = completeOnboarding(selected, intent);
    onComplete?.(onboardingDestination(state));
  }

  function backToChoice() {
    if (!selected) return;
    // Drop the recorded path so a reload resumes on the choice screen rather
    // than reopening a sequence the learner just backed out of.
    saveOnboardingState({ version: 1, courseSlug: selected, status: 'welcome-in-progress' });
    setScreen('choice');
  }

  if (screen === 'first-win' && selectedFirstWin) {
    return (
      <div>
        <button type="button" className={styles.backButton} onClick={backToChoice}>
          <span aria-hidden="true">←</span> Back
        </button>
        <FirstWinFlow firstWin={selectedFirstWin} onFinish={finish} />
      </div>
    );
  }

  if (screen === 'choice' && selectedLanguage) {
    return (
      <div className={styles.flow}>
        <button type="button" className={styles.backButton} onClick={backToLanguage}><span aria-hidden="true">←</span> Back</button>
        <h2 className={styles.title}>Where should we start?</h2>
        <p className={styles.copy}>
          Pick the pace that fits you. There is no wrong answer, and you can change it later.
        </p>
        <div className={styles.choiceGrid}>
          <button type="button" className={styles.choiceCard} onClick={() => choose('beginner')}>
            <span className={styles.choiceBadge}>Recommended</span>
            <h3>Start from the beginning</h3>
            <p>
              {selectedFirstWin
                ? 'One short sequence with your first phrase, then the course opens.'
                : 'Greetings and your first sentence, built one step at a time.'}
            </p>
          </button>
          {selectedLanguage.placement ? (
            <button type="button" className={styles.choiceCard} onClick={() => choose('placement')}>
              <span className={styles.choiceBadge}>Experienced</span>
              <h3>I know some already</h3>
              <p>Answer a short {selectedLanguage.name} quiz and we will suggest where to start.</p>
            </button>
          ) : (
            <button type="button" className={styles.choiceCard} onClick={() => choose('preview')}>
              <span className={styles.choiceBadge}>Just looking</span>
              <h3>Show me the course first</h3>
              <p>No quiz for {selectedLanguage.name} yet. Browse the lessons before you begin.</p>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.flow}>
      {notice ? <p className={styles.copy}>{notice}</p> : null}
      <h2 className={styles.title}>What would you like to speak first?</h2>
      <p className={styles.copy}>
        Choose a language. You will start with a short first success, then follow the course from the beginning.
      </p>
      <fieldset className={styles.languageGroup} aria-labelledby="language-legend">
        <legend id="language-legend" className={styles.srOnly}>Choose a language</legend>
        {languages.map((language) => (
          <label key={language.slug} className={`${styles.card} ${selected === language.slug ? styles.cardSelected : ''}`}>
            <input
              className={styles.radio}
              type="radio"
              name="onboarding-language"
              value={language.slug}
              checked={selected === language.slug}
              onChange={() => chooseLanguage(language.slug)}
            />
            <span className={styles.cardBody}>
              <span className={styles.flag} aria-hidden="true">{language.flag}</span>
              <span className={styles.cardText}>
                <span className={styles.languageName}>{language.name}</span>
                <span className={styles.availability}>{language.availability}</span>
                <span className={styles.benefit}>{language.benefit}</span>
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className={styles.primary}
        disabled={!selected}
        onClick={continueLanguage}
      >
        Continue with {selectedLanguage?.name ?? 'your language'}
      </button>
    </div>
  );
}
