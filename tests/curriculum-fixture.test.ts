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

  it('uses practical ordering patterns instead of cognate lessons', () => {
    // Break caught: fixtures regressing to abstract cognate-focused wording.
    expect(initialCourses.find((course) => course.slug === 'english-to-french')?.concepts.find((concept) => concept.id === 'fr-ordering-politely')).toMatchObject({
      title: 'French: ordering politely with “Je voudrais…”',
      explanation: expect.stringContaining('Je voudrais'),
    });
    expect(initialCourses.find((course) => course.slug === 'english-to-italian')?.concepts.find((concept) => concept.id === 'it-ordering-politely')).toMatchObject({
      title: 'Italian: ordering politely with “Vorrei…”',
      explanation: expect.stringContaining('Vorrei'),
    });
    expect(JSON.stringify(initialCourses).toLowerCase()).not.toContain('cognate');
    expect(JSON.stringify(initialCourses)).not.toContain('Thinking Method');
  });

  it('authors five original travel patterns for every course', () => {
    for (const course of initialCourses) {
      expect(course.concepts).toHaveLength(5);
      expect(course.concepts.map((concept) => concept.position)).toEqual([1, 2, 3, 4, 5]);
      expect(course.concepts.every((concept) => concept.scenario && concept.notice && concept.modelDialogue)).toBe(true);
    }
  });

  it('gives every authored pattern a controlled variation instead of repeating its model target', () => {
    // Break caught: a nominal vary step reproduces the build answer without changing an item or context.
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
    // Break caught: finding-place practice regresses to simple noun substitution.
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
    // Break caught: greeting or payment vary practice simply echoes the model answer.
    const concept = initialCourses
      .find((course) => course.slug === courseSlug)
      ?.concepts.find((candidate) => candidate.id === conceptId);

    expect(concept?.drills[0]?.recallTarget).toBe(recallTarget);
    expect(concept?.drills[0]?.recallTarget).not.toBe(concept?.modelDialogue.answer);
  });
});
