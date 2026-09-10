import { afterEach, describe, expect, it } from 'vitest';
import {
  onboardingDestination,
  onboardingLanguages,
  readOnboardingState,
  saveOnboardingState,
  setSelectedCourse,
} from '@/features/onboarding/state';
import { initialCourses } from '@/features/curriculum/fixture';

afterEach(() => {
  localStorage.clear();
});

describe('onboarding state contract', () => {
  it('returns null when no onboarding state is stored', () => {
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('accepts only a current available course from versioned onboarding storage', () => {
    localStorage.setItem('verbalibera_onboarding:v1', JSON.stringify({
      version: 1, courseSlug: 'english-to-italian', status: 'welcome-in-progress', entryIntent: 'beginner',
    }));
    expect(readOnboardingState(initialCourses)?.courseSlug).toBe('english-to-italian');
  });

  it('rejects an unknown or unavailable course slug', () => {
    localStorage.setItem('verbalibera_onboarding:v1', JSON.stringify({
      version: 1, courseSlug: 'english-to-klingon', status: 'completed',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('rejects an unsupported version', () => {
    localStorage.setItem('verbalibera_onboarding:v1', JSON.stringify({
      version: 2, courseSlug: 'english-to-french', status: 'completed',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('rejects an invalid status or entryIntent', () => {
    localStorage.setItem('verbalibera_onboarding:v1', JSON.stringify({
      version: 1, courseSlug: 'english-to-french', status: 'learning',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();

    localStorage.setItem('verbalibera_onboarding:v1', JSON.stringify({
      version: 1, courseSlug: 'english-to-french', status: 'completed', entryIntent: 'tour',
    }));
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('never throws on corrupt JSON', () => {
    localStorage.setItem('verbalibera_onboarding:v1', 'not json');
    expect(readOnboardingState(initialCourses)).toBeNull();
  });

  it('sends placement learners to the existing course placement route', () => {
    expect(onboardingDestination({ version: 1, courseSlug: 'english-to-german', status: 'welcome-in-progress', entryIntent: 'placement' }))
      .toBe('/learn/english-to-german/placement');
  });

  it('sends beginners to the selected course foundations', () => {
    expect(onboardingDestination({ version: 1, courseSlug: 'english-to-italian', status: 'welcome-in-progress', entryIntent: 'beginner' }))
      .toBe('/courses/italian?start=1');
  });

  it('writes the existing verbalibera_course key when a course is selected', () => {
    setSelectedCourse('english-to-spanish');
    expect(localStorage.getItem('verbalibera_course')).toBe('english-to-spanish');
  });

  it('persists onboarding state round-trip', () => {
    saveOnboardingState({ version: 1, courseSlug: 'english-to-portuguese', status: 'completed', entryIntent: 'beginner' });
    expect(readOnboardingState(initialCourses)?.status).toBe('completed');
  });

  it('derives presentation metadata from the catalog', () => {
    const languages = onboardingLanguages(initialCourses);
    expect(languages).toHaveLength(4);
    const italian = languages.find((entry) => entry.slug === 'english-to-italian');
    expect(italian?.flag).toBe('🇮🇹');
    expect(italian?.availability).toBe('Structured A1 foundations');
    const spanish = languages.find((entry) => entry.slug === 'english-to-spanish');
    expect(spanish?.availability).toBe('Start with first words');
    expect(spanish?.benefit).toMatch(/greetings/);
  });
});