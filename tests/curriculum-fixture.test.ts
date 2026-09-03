import { describe, expect, it } from 'vitest';
import { initialCourses } from '@/features/curriculum/fixture';

// Task 8: every authored French and Italian pattern ships real Kokoro clips.
// Only the original French ordering pilot (French `ff_siwis`) and the Task 7
// Italian set were the prior truth; Task 8 adds the remaining 4 French
// patterns and it-ordering.
const TASK_8_FR_AUDIO: Record<string, [string, string]> = {
  'fr-greet-politely': [
    '/audio/french/fr-greet-politely-prompt.wav',
    '/audio/french/fr-greet-politely-answer.wav',
  ],
  'fr-find-place': [
    '/audio/french/fr-find-place-prompt.wav',
    '/audio/french/fr-find-place-answer.wav',
  ],
  'fr-ask-help': [
    '/audio/french/fr-ask-help-prompt.wav',
    '/audio/french/fr-ask-help-answer.wav',
  ],
  'fr-pay-politely': [
    '/audio/french/fr-pay-politely-prompt.wav',
    '/audio/french/fr-pay-politely-answer.wav',
  ],
};

const TASK_7_IT_AUDIO: Record<string, [string, string]> = {
  'it-greet-politely': [
    '/audio/italian/it-greet-politely-prompt.wav',
    '/audio/italian/it-greet-politely-answer.wav',
  ],
  'it-find-place': [
    '/audio/italian/it-find-place-prompt.wav',
    '/audio/italian/it-find-place-answer.wav',
  ],
  'it-ask-help': [
    '/audio/italian/it-ask-help-prompt.wav',
    '/audio/italian/it-ask-help-answer.wav',
  ],
  'it-ordering-politely': [
    '/audio/italian/it-ordering-politely-prompt.wav',
    '/audio/italian/it-ordering-politely-answer.wav',
  ],
  'it-pay-politely': [
    '/audio/italian/it-pay-politely-prompt.wav',
    '/audio/italian/it-pay-politely-answer.wav',
  ],
};

const SHIPPED_AUDIO = { ...TASK_8_FR_AUDIO, ...TASK_7_IT_AUDIO };
const FR_PILOT: [string, string] = [
  '/audio/french-ordering/fr-ordering-politely-prompt.wav',
  '/audio/french-ordering/fr-ordering-politely-answer.wav',
];

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
      expect(concept?.drills).toEqual([
        expect.objectContaining({
          conceptId: concept?.id,
          kind: 'TRANSFORMATION',
          contentProvenance: 'ORIGINAL',
        }),
      ]);
    }
  });

  it('uses practical ordering patterns instead of cognate lessons', () => {
    expect(initialCourses.find((c) => c.slug === 'english-to-french')?.concepts.find((c) => c.id === 'fr-ordering-politely')).toMatchObject({
      title: 'French: ordering politely with “Je voudrais…”',
      explanation: expect.stringContaining('Je voudrais'),
    });
    expect(initialCourses.find((c) => c.slug === 'english-to-italian')?.concepts.find((c) => c.id === 'it-ordering-politely')).toMatchObject({
      title: 'Italian: ordering politely with “Vorrei…”',
      explanation: expect.stringContaining('Vorrei'),
    });
    expect(JSON.stringify(initialCourses).toLowerCase()).not.toContain('cognate');
    expect(JSON.stringify(initialCourses)).not.toContain('Thinking Method');
  });

  it('every concept has a real /audio/ URL — no unavailable:// for any shipped clip (Task 8 done)', () => {
    // Break caught: any pattern that should ship real audio still pointing at unavailable://.
    const all = initialCourses.flatMap((c) => c.concepts);
    for (const concept of all) {
      expect(concept.audioSegments).toHaveLength(2);
      for (const segment of concept.audioSegments) {
        expect(
          segment.audioUrl,
          `${concept.id}/${segment.id} must have real audio after Task 8`,
        ).toMatch(/^\/audio\//);
        expect(segment.audioUrl).not.toContain('unavailable://');
      }
    }
  });

  it('uses expected shipped audio URLs for every pattern', () => {
    for (const course of initialCourses) {
      for (const concept of course.concepts) {
        const expected =
          concept.id === 'fr-ordering-politely'
            ? FR_PILOT
            : SHIPPED_AUDIO[concept.id];
        expect(
          concept.audioSegments.map((s) => s.audioUrl),
          `${concept.id} must use shipped audio URLs`,
        ).toEqual(expected);
      }
    }
  });

  it('authors five original travel patterns for every course', () => {
    for (const course of initialCourses) {
      expect(course.concepts).toHaveLength(5);
      expect(course.concepts.map((concept) => concept.position)).toEqual([1, 2, 3, 4, 5]);
      expect(course.concepts.every((concept) => concept.scenario && concept.notice && concept.modelDialogue)).toBe(true);
    }
  });

  it('gives every authored pattern a controlled variation instead of repeating its model target', () => {
    for (const course of initialCourses) {
      for (const concept of course.concepts) {
        expect(concept.drills).toHaveLength(1);
        expect(concept.drills[0]).toMatchObject({
          conceptId: concept.id,
          contentProvenance: 'ORIGINAL',
        });
        expect(concept.drills[0]?.acceptedResponses).toContain(concept.drills[0]?.recallTarget);
        expect(concept.drills[0]?.recallTarget).not.toBe(concept.modelDialogue.answer);
      }
    }
  });

  it.each([
    ['english-to-french', 'fr-find-place', 'Turn “Le musée est ici.” into a question asking where the museum is.', 'Où est le musée ?'],
    ['english-to-italian', 'it-find-place', 'Turn “Il museo è qui.” into a question asking where the museum is.', 'Dov’è il museo?'],
  ])('uses a statement-to-question transformation for %s finding-place practice', (courseSlug, conceptId, prompt, recallTarget) => {
    const concept = initialCourses
      .find((course) => course.slug === courseSlug)
      ?.concepts.find((candidate) => candidate.id === conceptId);

    expect(concept?.drills[0]).toMatchObject({
      kind: 'TRANSFORMATION',
      prompt,
      recallTarget,
      acceptedResponses: [recallTarget],
      contentProvenance: 'ORIGINAL',
    });
  });

  it.each([
    ['english-to-french', 'fr-greet-politely', 'Bonjour, je voudrais un café, s’il vous plaît.'],
    ['english-to-italian', 'it-greet-politely', 'Buongiorno, vorrei un caffè, per favore.'],
    ['english-to-french', 'fr-pay-politely', 'Je voudrais payer par carte, s’il vous plaît.'],
    ['english-to-italian', 'it-pay-politely', 'Vorrei pagare con la carta, per favore.'],
  ])('varies the requested item or payment context for %s %s', (courseSlug, conceptId, recallTarget) => {
    const concept = initialCourses
      .find((course) => course.slug === courseSlug)
      ?.concepts.find((candidate) => candidate.id === conceptId);

    expect(concept?.drills[0]?.recallTarget).toBe(recallTarget);
    expect(concept?.drills[0]?.recallTarget).not.toBe(concept?.modelDialogue.answer);
  });
});
