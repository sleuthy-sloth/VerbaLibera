'use client';

import { useState } from 'react';
import { onboardingDestination, saveOnboardingState, setSelectedCourse, type OnboardingLanguage } from '@/features/onboarding/state';
import styles from './welcome-flow.module.css';

type Screen = 'language' | 'choice';

export function WelcomeFlow({
  courses,
  onComplete,
}: {
  courses: readonly { slug: string; title: string }[];
  onComplete?: (destination: string) => void;
}) {
  const [screen, setScreen] = useState<Screen>('language');
  const [selected, setSelected] = useState<string | null>(null);
  const languages: OnboardingLanguage[] = courses.map((course) => {
    const language = course.slug.replace(/^english-to-/, '');
    const flagByLang: Record<string, string> = { french: '🇫🇷', italian: '🇮🇹', spanish: '🇪🇸', portuguese: '🇵🇹' };
    const isStructuredA1 = language === 'french' || language === 'italian';
    return {
      slug: course.slug,
      name: course.title.replace(/^English to /, '').replace(/: A1 patterns$/, ''),
      flag: flagByLang[language] ?? '🌐',
      availability: isStructuredA1 ? 'Structured A1 foundations' : 'Start with first words',
      benefit: `Learn ${language[0].toUpperCase() + language.slice(1)} greetings and first phrases through worked examples.`,
    };
  });

  const selectedLanguage = languages.find((entry) => entry.slug === selected);

  function chooseLanguage(slug: string) {
    setSelected(slug);
    setSelectedCourse(slug);
  }

  function continueLanguage() {
    if (!selected) return;
    setScreen('choice');
  }

  function backToLanguage() {
    setScreen('language');
  }

  function beginBeginner() {
    if (!selected) return;
    saveOnboardingState({ version: 1, courseSlug: selected, status: 'welcome-in-progress', entryIntent: 'beginner' });
    const destination = onboardingDestination({ version: 1, courseSlug: selected, status: 'welcome-in-progress', entryIntent: 'beginner' });
    onComplete?.(destination);
  }

  function takePlacement() {
    if (!selected) return;
    saveOnboardingState({ version: 1, courseSlug: selected, status: 'welcome-in-progress', entryIntent: 'placement' });
    const destination = onboardingDestination({ version: 1, courseSlug: selected, status: 'welcome-in-progress', entryIntent: 'placement' });
    onComplete?.(destination);
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
          <button type="button" className={styles.choiceCard} onClick={beginBeginner}>
            <span className={styles.choiceBadge}>Recommended</span>
            <h3>Start from the beginning</h3>
            <p>A friendly 2-minute first phrase.</p>
          </button>
          <button type="button" className={styles.choiceCard} onClick={takePlacement}>
            <span className={styles.choiceBadge}>Experienced</span>
            <h3>I know some already</h3>
            <p>Take a 3-minute placement quiz.</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.flow}>
      <h2 className={styles.title}>What would you like to speak first?</h2>
      <p className={styles.copy}>
        Choose a language. You will get a short first success, then enter the course at the right level.
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