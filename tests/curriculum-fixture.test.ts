import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

// Spanish expansion: full 8-pattern English-to-Spanish course (Kokoro `ef_dora`)
// plus 3 new travel patterns (directions, hotel, emergency) in French + Italian.
const ES_AUDIO: Record<string, [string, string]> = {
  'es-greet-politely': [
    '/audio/spanish/es-greet-politely-prompt.wav',
    '/audio/spanish/es-greet-politely-answer.wav',
  ],
  'es-ordering-politely': [
    '/audio/spanish/es-ordering-politely-prompt.wav',
    '/audio/spanish/es-ordering-politely-answer.wav',
  ],
  'es-find-place': [
    '/audio/spanish/es-find-place-prompt.wav',
    '/audio/spanish/es-find-place-answer.wav',
  ],
  'es-ask-help': [
    '/audio/spanish/es-ask-help-prompt.wav',
    '/audio/spanish/es-ask-help-answer.wav',
  ],
  'es-pay-politely': [
    '/audio/spanish/es-pay-politely-prompt.wav',
    '/audio/spanish/es-pay-politely-answer.wav',
  ],
  'es-ask-directions': [
    '/audio/spanish/es-ask-directions-prompt.wav',
    '/audio/spanish/es-ask-directions-answer.wav',
  ],
  'es-hotel-checkin': [
    '/audio/spanish/es-hotel-checkin-prompt.wav',
    '/audio/spanish/es-hotel-checkin-answer.wav',
  ],
  'es-emergency-help': [
    '/audio/spanish/es-emergency-help-prompt.wav',
    '/audio/spanish/es-emergency-help-answer.wav',
  ],
};

const EXPANSION_FR_IT_AUDIO: Record<string, [string, string]> = {
  'fr-ask-directions': [
    '/audio/french/fr-ask-directions-prompt.wav',
    '/audio/french/fr-ask-directions-answer.wav',
  ],
  'fr-hotel-checkin': [
    '/audio/french/fr-hotel-checkin-prompt.wav',
    '/audio/french/fr-hotel-checkin-answer.wav',
  ],
  'fr-emergency-help': [
    '/audio/french/fr-emergency-help-prompt.wav',
    '/audio/french/fr-emergency-help-answer.wav',
  ],
  'it-ask-directions': [
    '/audio/italian/it-ask-directions-prompt.wav',
    '/audio/italian/it-ask-directions-answer.wav',
  ],
  'it-hotel-checkin': [
    '/audio/italian/it-hotel-checkin-prompt.wav',
    '/audio/italian/it-hotel-checkin-answer.wav',
  ],
  'it-emergency-help': [
    '/audio/italian/it-emergency-help-prompt.wav',
    '/audio/italian/it-emergency-help-answer.wav',
  ],
};

// Portuguese expansion: full 8-pattern English-to-Portuguese course (Kokoro `pf_dora`).
const PT_AUDIO: Record<string, [string, string]> = {
  'pt-greet-politely': [
    '/audio/portuguese/pt-greet-politely-prompt.wav',
    '/audio/portuguese/pt-greet-politely-answer.wav',
  ],
  'pt-ordering-politely': [
    '/audio/portuguese/pt-ordering-politely-prompt.wav',
    '/audio/portuguese/pt-ordering-politely-answer.wav',
  ],
  'pt-find-place': [
    '/audio/portuguese/pt-find-place-prompt.wav',
    '/audio/portuguese/pt-find-place-answer.wav',
  ],
  'pt-ask-help': [
    '/audio/portuguese/pt-ask-help-prompt.wav',
    '/audio/portuguese/pt-ask-help-answer.wav',
  ],
  'pt-pay-politely': [
    '/audio/portuguese/pt-pay-politely-prompt.wav',
    '/audio/portuguese/pt-pay-politely-answer.wav',
  ],
  'pt-ask-directions': [
    '/audio/portuguese/pt-ask-directions-prompt.wav',
    '/audio/portuguese/pt-ask-directions-answer.wav',
  ],
  'pt-hotel-checkin': [
    '/audio/portuguese/pt-hotel-checkin-prompt.wav',
    '/audio/portuguese/pt-hotel-checkin-answer.wav',
  ],
  'pt-emergency-help': [
    '/audio/portuguese/pt-emergency-help-prompt.wav',
    '/audio/portuguese/pt-emergency-help-answer.wav',
  ],
};

const SHIPPED_AUDIO = { ...TASK_8_FR_AUDIO, ...TASK_7_IT_AUDIO, ...ES_AUDIO, ...EXPANSION_FR_IT_AUDIO, ...PT_AUDIO };
const FR_PILOT: [string, string] = [
  '/audio/french-ordering/fr-ordering-politely-prompt.wav',
  '/audio/french-ordering/fr-ordering-politely-answer.wav',
];

describe('initial curriculum fixtures', () => {
  it('contains separate original English-to-French, English-to-Italian, English-to-Spanish, and English-to-Portuguese A1 courses', () => {
    expect(initialCourses.map((course) => course.slug)).toEqual([
      'english-to-french',
      'english-to-italian',
      'english-to-spanish',
      'english-to-portuguese',
    ]);
    expect(initialCourses.every((course) => course.sourceLanguageCode === 'en')).toBe(true);
    expect(initialCourses.map((course) => course.targetLanguageCode)).toEqual(['fr', 'it', 'es', 'pt']);
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
      expect(concept?.drills[0]).toEqual(
        expect.objectContaining({
          conceptId: concept?.id,
          kind: 'TRANSFORMATION',
          contentProvenance: 'ORIGINAL',
        }),
      );
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
    expect(initialCourses.find((c) => c.slug === 'english-to-spanish')?.concepts.find((c) => c.id === 'es-ordering-politely')).toMatchObject({
      title: 'Spanish: ordering politely with “Quisiera…”',
      explanation: expect.stringContaining('Quisiera'),
    });
    expect(initialCourses.find((c) => c.slug === 'english-to-portuguese')?.concepts.find((c) => c.id === 'pt-ordering-politely')).toMatchObject({
      title: 'Portuguese: ordering politely with “Gostaria…”',
      explanation: expect.stringContaining('gostaria'),
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

  it('authors eight original travel patterns for every course', () => {
    for (const course of initialCourses) {
      expect(course.concepts).toHaveLength(8);
      expect(course.concepts.map((concept) => concept.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(course.concepts.every((concept) => concept.scenario && concept.notice && concept.modelDialogue)).toBe(true);
    }
  });

  it('gives every authored pattern a controlled variation instead of repeating its model target', () => {
    for (const course of initialCourses) {
      for (const concept of course.concepts) {
        const textDrill = concept.drills[0];
        expect(textDrill).toMatchObject({
          conceptId: concept.id,
          contentProvenance: 'ORIGINAL',
        });
        expect(textDrill?.acceptedResponses).toContain(textDrill?.recallTarget);
        expect(textDrill?.recallTarget).not.toBe(concept.modelDialogue.answer);
      }
    }
  });

  it('adds a picture-choice vocab drill to every pattern', () => {
    const seenImages = new Set<string>();
    for (const course of initialCourses) {
      for (const concept of course.concepts) {
        expect(concept.drills).toHaveLength(2);
        const picture = concept.drills[1];
        expect(picture).toMatchObject({
          id: `${concept.id}-picture`,
          conceptId: concept.id,
          kind: 'PICTURE_CHOICE',
          contentProvenance: 'ORIGINAL',
        });
        expect(picture?.acceptedResponses).toEqual([picture?.recallTarget]);
        expect(picture?.choices).toHaveLength(4);
        expect(
          picture?.choices?.every((c) => c.imageUrl.startsWith('/images/vocab/') && c.imageUrl.endsWith('.jpg') && c.alt.length > 0),
        ).toBe(true);
        expect(picture?.choices?.some((c) => c.id === picture?.recallTarget)).toBe(true);
        expect(new Set(picture?.choices?.map((c) => c.id)).size).toBe(4);
        for (const choice of picture?.choices ?? []) {
          seenImages.add(choice.imageUrl);
          // Break caught: fixture references a vocab image that was never committed.
          expect(existsSync(join(process.cwd(), 'public', choice.imageUrl)), `${choice.imageUrl} must exist on disk`).toBe(true);
        }
      }
    }
    // 22 unique CC0 photos cover all 8 patterns (shared across languages).
    expect(seenImages.size).toBe(22);
  });

  it.each([
    ['english-to-french', 'fr-find-place', 'Turn “Le musée est ici.” into a question asking where the museum is.', 'Où est le musée ?'],
    ['english-to-italian', 'it-find-place', 'Turn “Il museo è qui.” into a question asking where the museum is.', 'Dov’è il museo?'],
    ['english-to-spanish', 'es-find-place', 'Turn “El museo está aquí.” into a question asking where the museum is.', '¿Dónde está el museo?'],
    ['english-to-portuguese', 'pt-find-place', 'Turn “O museu fica aqui.” into a question asking where the museum is.', 'Onde fica o museu?'],
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
    ['english-to-spanish', 'es-greet-politely', 'Hola, quisiera un café, por favor.'],
    ['english-to-french', 'fr-pay-politely', 'Je voudrais payer par carte, s’il vous plaît.'],
    ['english-to-italian', 'it-pay-politely', 'Vorrei pagare con la carta, per favore.'],
    ['english-to-spanish', 'es-pay-politely', 'Quisiera pagar con tarjeta, por favor.'],
    ['english-to-portuguese', 'pt-greet-politely', 'Olá, eu gostaria de um café, por favor.'],
    ['english-to-portuguese', 'pt-pay-politely', 'Eu gostaria de pagar com cartão, por favor.'],
  ])('varies the requested item or payment context for %s %s', (courseSlug, conceptId, recallTarget) => {
    const concept = initialCourses
      .find((course) => course.slug === courseSlug)
      ?.concepts.find((candidate) => candidate.id === conceptId);

    expect(concept?.drills[0]?.recallTarget).toBe(recallTarget);
    expect(concept?.drills[0]?.recallTarget).not.toBe(concept?.modelDialogue.answer);
  });
});
