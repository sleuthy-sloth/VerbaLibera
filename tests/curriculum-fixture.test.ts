import { initialCourses } from '@/features/curriculum/fixture';

describe('initial curriculum fixtures', () => {
  it('contains separate original English-to-French and English-to-Italian A1 courses', () => {
    expect(initialCourses.map((course) => course.slug)).toEqual([
      'english-to-french',
      'english-to-italian',
    ]);
    expect(initialCourses.every((course) => course.sourceLanguageCode === 'en')).toBe(true);
    expect(initialCourses.map((course) => course.targetLanguageCode)).toEqual(['fr', 'it']);
    expect(initialCourses.every((course) => course.concepts[0]?.cefrLevel === 'A1')).toBe(true);
  });

  it('provides an original active-pause transformation drill for each course', () => {
    for (const course of initialCourses) {
      const concept = course.concepts[0];

      expect(concept?.contentProvenance).toBe('ORIGINAL');
      expect(concept?.audioSegments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'PROMPT', pauseAfter: true }),
          expect.objectContaining({ type: 'ANSWER', pauseAfter: false }),
        ]),
      );
      expect(concept?.audioSegments.every((segment) => segment.audioUrl.startsWith('unavailable://'))).toBe(
        true,
      );
      expect(concept?.drills).toEqual([
        expect.objectContaining({
          conceptId: concept?.id,
          kind: 'TRANSFORMATION',
          contentProvenance: 'ORIGINAL',
        }),
      ]);
    }
  });
});
