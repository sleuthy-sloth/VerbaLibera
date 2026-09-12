import { describe, expect, it, beforeEach } from 'vitest';
import { foundationPreferencesSchema, DEFAULT_FOUNDATION_PREFERENCES, readFoundationPreferences, saveFoundationPreferences, resetFoundationPreferences } from '@/features/course-pack/foundation-preferences';
import { selectDailyWithPreferences } from '@/features/course-pack/progress';
import type { CoursePack } from '@/features/course-pack/schema';

const pack = {
  id: 'it-foundations', version: '1.0.0', language: 'it', status: 'active', title: 'Italian foundations', sourceLanguage: 'en', description: 'x', attribution: 'x', units: [{ id: 'u', title: 'u', objective: 'o' }], concepts: [{ id: 'c', title: 'c', explanation: 'e', examples: [{ target: 'ciao', meaning: 'hi' }], commonError: 'x' }], vocabulary: [], media: [], dialogues: [], lessons: [
    { id: 'lesson-one', unitId: 'u', title: 'One', objective: 'o', cefr: 'A1', prerequisites: [], conceptIds: ['c'], vocabulary: [], explanation: 'e', examples: [{ target: 'ciao', meaning: 'hi' }, { target: 'ciao', meaning: 'hi' }], exercises: [
      { id: 'read', kind: 'choice', mode: 'recognition', conceptId: 'c', prompt: 'p', explanation: 'e', answers: ['a'], options: ['a', 'b'], vocabulary: [], reviewOf: [] },
      { id: 'listen', kind: 'dictation', mode: 'listening', conceptId: 'c', prompt: 'p', explanation: 'e', answers: ['a'], audioId: 'audio', vocabulary: [], reviewOf: [] },
      { id: 'build', kind: 'translate', mode: 'production', conceptId: 'c', prompt: 'p', explanation: 'e', answers: ['a'], vocabulary: [], reviewOf: [] },
      { id: 'build-two', kind: 'translate', mode: 'production', conceptId: 'c', prompt: 'p', explanation: 'e', answers: ['a'], vocabulary: [], reviewOf: [] },
    ], optionalExerciseIds: [] },
  ],
} as unknown as CoursePack;

describe('foundation practice preferences', () => {
  beforeEach(() => localStorage.clear());
  it('applies safe defaults and rejects malformed values', () => {
    expect(DEFAULT_FOUNDATION_PREFERENCES).toMatchObject({ version: 1, minutesPerDay: 10, goal: 'balanced', listening: 'available', guidance: 'balanced', preferredModes: [] });
    expect(foundationPreferencesSchema.safeParse({ version: 1, minutesPerDay: 99 }).success).toBe(false);
  });
  it('keeps guest and account preferences in separate local scopes', () => {
    saveFoundationPreferences({ ...DEFAULT_FOUNDATION_PREFERENCES, packId: 'it-foundations', minutesPerDay: 15 }, null);
    saveFoundationPreferences({ ...DEFAULT_FOUNDATION_PREFERENCES, packId: 'fr-foundations', minutesPerDay: 5 }, 'user-a');
    expect(readFoundationPreferences(null).packId).toBe('it-foundations');
    expect(readFoundationPreferences('user-a').packId).toBe('fr-foundations');
    resetFoundationPreferences('user-a');
    expect(readFoundationPreferences('user-a')).toEqual(DEFAULT_FOUNDATION_PREFERENCES);
  });
  it('honors disabled listening and mode preference without removing due review or prerequisites', () => {
    const result = selectDailyWithPreferences(pack, [], 10, new Date(), { ...DEFAULT_FOUNDATION_PREFERENCES, listening: 'off', preferredModes: ['build'] });
    expect(result.exerciseIds).not.toContain('listen');
    expect(result.exerciseIds).toContain('build');
    expect(result.lessonId).toBe('lesson-one');
  });
});
