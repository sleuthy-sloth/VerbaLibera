import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationEntryLesson } from '@/features/placement/foundation-entry';

function lessonIds(language: 'italian' | 'french'): Set<string> {
  const manifest = JSON.parse(readFileSync(`courses/${language}/manifest.json`, 'utf8'));
  return new Set(manifest.lessons.map((lesson: { id: string }) => lesson.id));
}

describe('foundation entry', () => {
  it('maps every A1 item id to a real Italian lesson', () => {
    expect(foundationEntryLesson('english-to-italian', 'A1', 'it-place-1')).toBe('it-first-words-foundation');
  });

  it('starts greeting-missers at first words in both languages', () => {
    expect(foundationEntryLesson('english-to-french', 'A1', 'fr-place-1')).toBe('fr-first-words-foundation');
    expect(foundationEntryLesson('english-to-italian', 'A1', 'it-place-1')).toBe('it-first-words-foundation');
  });

  it('returns null for courses without foundation packs', () => {
    expect(foundationEntryLesson('english-to-klingon', 'A1', 'xx-place-1')).toBeNull();
  });

  it('starts single-lesson packs at first words whatever A1 item is missed', () => {
    expect(foundationEntryLesson('english-to-spanish', 'A1', 'es-greet-politely-placement')).toBe('es-first-words-foundation');
    expect(foundationEntryLesson('english-to-spanish', 'A1', 'es-ordering-politely-placement')).toBe('es-first-words-foundation');
    expect(foundationEntryLesson('english-to-spanish', 'A2')).toBe('es-first-words-foundation');
    expect(foundationEntryLesson('english-to-portuguese', 'A1', 'pt-greet-politely-placement')).toBe('pt-first-words-foundation');
    expect(foundationEntryLesson('english-to-portuguese', 'B1')).toBe('pt-first-words-foundation');
  });

  it.each(['italian', 'french'] as const)('every %s mapped id exists in the manifest', (language) => {
    const courseSlug = `english-to-${language}`;
    const ids = lessonIds(language);
    for (const itemId of ['1', '2', '3', '4', '5'].map((n) => `${language === 'italian' ? 'it' : 'fr'}-place-${n}`)) {
      const lesson = foundationEntryLesson(courseSlug, 'A1', itemId);
      expect(lesson, itemId).not.toBeNull();
      expect(ids.has(lesson!)).toBe(true);
    }
    for (const band of ['A2', 'B1'] as const) {
      const lesson = foundationEntryLesson(courseSlug, band);
      expect(lesson, band).not.toBeNull();
      expect(ids.has(lesson!)).toBe(true);
    }
  });
});
