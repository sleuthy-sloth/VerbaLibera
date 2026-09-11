import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeOnboarding,
  onboardingDestination,
  onboardingLanguages,
  onboardingResumeScreen,
  readOnboardingOutcome,
  readOnboardingState,
  saveOnboardingState,
  setSelectedCourse,
} from '@/features/onboarding/state';
import { languagesFor } from '@/features/onboarding/languages';
import { hasAuthoredPlacement } from '@/features/placement/items';
import { initialCourses } from '@/features/curriculum/fixture';
import catalog from '@/features/course-pack/catalog.json';

const ONBOARDING_KEY = 'verbalibera_onboarding:v1';

afterEach(() => {
  localStorage.clear();
});

describe('onboarding state contract', () => {
  it('returns null when no onboarding state is stored', () => {
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('accepts only a current available course from versioned onboarding storage', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 1, courseSlug: 'english-to-italian', status: 'welcome-in-progress', entryIntent: 'beginner',
    }));
    expect(readOnboardingState(initialCourses)?.courseSlug).toBe('english-to-italian');
  });

  it('rejects an unknown or unavailable course slug', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 1, courseSlug: 'english-to-klingon', status: 'completed',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('rejects an unsupported version', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 2, courseSlug: 'english-to-french', status: 'completed',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('rejects an invalid status or entryIntent', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 1, courseSlug: 'english-to-french', status: 'learning',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();

    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 1, courseSlug: 'english-to-french', status: 'completed', entryIntent: 'tour',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('never throws on corrupt JSON', () => {
    localStorage.setItem(ONBOARDING_KEY, 'not json');
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('distinguishes a new learner from an unreadable record', () => {
    expect(readOnboardingOutcome(initialCourses)).toEqual({ kind: 'unseen' });

    localStorage.setItem(ONBOARDING_KEY, 'not json');
    expect(readOnboardingOutcome(initialCourses)).toEqual({ kind: 'invalid' });

    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 1, courseSlug: 'english-to-klingon', status: 'completed',
    }));
    expect(readOnboardingOutcome(initialCourses)).toEqual({ kind: 'invalid' });

    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({
      version: 1, courseSlug: 'english-to-spanish', status: 'welcome-in-progress',
    }));
    expect(readOnboardingOutcome(initialCourses).kind).toBe('stored');
  });

  it('sends beginners to the selected course foundations', () => {
    expect(onboardingDestination({ version: 1, courseSlug: 'english-to-italian', status: 'completed', entryIntent: 'beginner' }))
      .toBe('/courses/italian?start=1');
  });

  it('sends placement learners to a placement quiz only where one is authored', () => {
    expect(onboardingDestination({ version: 1, courseSlug: 'english-to-french', status: 'completed', entryIntent: 'placement' }))
      .toBe('/learn/english-to-french/placement');
    expect(hasAuthoredPlacement('english-to-french')).toBe(true);
    expect(hasAuthoredPlacement('english-to-italian')).toBe(true);
  });

  it('never routes an unsupported language into a placement quiz', () => {
    for (const slug of ['english-to-spanish', 'english-to-portuguese', 'english-to-german']) {
      expect(hasAuthoredPlacement(slug)).toBe(false);
      const destination = onboardingDestination({
        version: 1, courseSlug: slug, status: 'completed', entryIntent: 'placement',
      });
      expect(destination).not.toContain('/placement');
    }
    // Spanish has a foundation pack, so the truthful alternative is its course page.
    expect(onboardingDestination({ version: 1, courseSlug: 'english-to-spanish', status: 'completed', entryIntent: 'placement' }))
      .toBe('/courses/spanish');
  });

  it('routes the preview intent to the course page, not into a lesson', () => {
    expect(onboardingDestination({ version: 1, courseSlug: 'english-to-spanish', status: 'completed', entryIntent: 'preview' }))
      .toBe('/courses/spanish');
  });

  it('writes the completion transition and stops resuming', () => {
    const state = completeOnboarding('english-to-french', 'beginner');
    expect(state.status).toBe('completed');
    expect(readOnboardingState(initialCourses)?.status).toBe('completed');
    expect(onboardingResumeScreen(readOnboardingState(initialCourses))).toBeNull();
    // A completed record must not open the flow again.
    expect(readOnboardingOutcome(initialCourses).kind).toBe('stored');
  });

  it('resumes on the starting-point screen while a language is chosen but not acted on', () => {
    saveOnboardingState({ version: 1, courseSlug: 'english-to-italian', status: 'welcome-in-progress' });
    const stored = readOnboardingState(initialCourses);
    expect(onboardingResumeScreen(stored)).toBe('choice');
    saveOnboardingState({ version: 1, courseSlug: 'english-to-italian', status: 'unseen' });
    expect(onboardingResumeScreen(readOnboardingState(initialCourses))).toBe('language');
    expect(onboardingResumeScreen(null)).toBeNull();
  });

  it('keeps working for one session when storage is denied', () => {
    const denied = {
      getItem: vi.fn(() => { throw new Error('denied'); }),
      setItem: vi.fn(() => { throw new Error('denied'); }),
      removeItem: vi.fn(() => { throw new Error('denied'); }),
      clear: vi.fn(() => { throw new Error('denied'); }),
    };
    vi.stubGlobal('localStorage', denied);
    try {
      expect(readOnboardingOutcome(initialCourses)).toEqual({ kind: 'unseen' });
      expect(() => completeOnboarding('english-to-french', 'beginner')).not.toThrow();
      // The session mirror carries it, so the flow does not re-open mid-session.
      expect(readOnboardingState(initialCourses)?.status).toBe('completed');
    } finally {
      vi.unstubAllGlobals();
    }
    // With storage back and empty, the record is gone — the documented cost.
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('writes the existing verbalibera_course key when a course is selected', () => {
    setSelectedCourse('english-to-spanish');
    expect(localStorage.getItem('verbalibera_course')).toBe('english-to-spanish');
  });

  it('persists onboarding state round-trip', () => {
    saveOnboardingState({ version: 1, courseSlug: 'english-to-portuguese', status: 'completed', entryIntent: 'beginner' });
    expect(readOnboardingState(initialCourses)?.status).toBe('completed');
  });
});

describe('onboarding language metadata has one source', () => {
  it('is the same function through both entry points', () => {
    expect(languagesFor(initialCourses)).toEqual(onboardingLanguages(initialCourses));
  });

  it('derives availability from the generated pack facts, not a language list', () => {
    const languages = onboardingLanguages(initialCourses);
    expect(languages).toHaveLength(4);
    const italian = languages.find((entry) => entry.slug === 'english-to-italian');
    const spanish = languages.find((entry) => entry.slug === 'english-to-spanish');
    // The numbers come from the foundation catalog, which is generated.
    const italianPack = catalog.find((entry) => entry.slug === 'italian');
    expect(italianPack).toBeDefined();
    expect(italian?.availability).toContain('Structured A1 foundations');
    expect(italian?.availability).toContain(`${italianPack?.lessons} lessons`);
    expect(spanish?.availability).toContain('First words');
    expect(spanish?.availability).toContain('8 lessons');
    // "Structured" follows the pack size, not the language's name.
    expect(italian?.availability.split(' · ')[0]).not.toBe(spanish?.availability.split(' · ')[0]);
  });

  it('flags placement capability per language, from the authored sets', () => {
    const languages = onboardingLanguages(initialCourses);
    expect(languages.find((entry) => entry.slug === 'english-to-french')?.placement).toBe(true);
    expect(languages.find((entry) => entry.slug === 'english-to-italian')?.placement).toBe(true);
    expect(languages.find((entry) => entry.slug === 'english-to-spanish')?.placement).toBe(false);
    expect(languages.find((entry) => entry.slug === 'english-to-portuguese')?.placement).toBe(false);
  });

  it('keeps the flag and benefit for every course in the list', () => {
    const languages = onboardingLanguages(initialCourses);
    expect(languages.find((entry) => entry.slug === 'english-to-italian')?.flag).toBe('🇮🇹');
    for (const language of languages) {
      expect(language.flag).not.toBe('🌐');
      expect(language.benefit).toMatch(/greetings/);
    }
  });
});
