import type { CourseFixture } from './types';

const unavailableAudio = (id: string) => `unavailable://original-demo/${id}`;

export const initialCourses = [
  {
    slug: 'english-to-french',
    sourceLanguageCode: 'en',
    targetLanguageCode: 'fr',
    title: 'English to French: A1 patterns',
    description: 'Original A1 demonstrations for using practical French patterns.',
    concepts: [
      {
        id: 'fr-ordering-politely',
        position: 1,
        cefrLevel: 'A1',
        title: 'French: ordering politely with “Je voudrais…”',
        explanation:
          'Use “Je voudrais un café, s’il vous plaît.” to order a coffee politely in French.',
        assessmentCriteria:
          'Say the full French sentence for ordering a coffee politely without seeing the answer.',
        contentProvenance: 'ORIGINAL',
        audioSegments: [
          {
            id: 'fr-ordering-politely-prompt',
            type: 'PROMPT',
            position: 1,
            pauseAfter: true,
            audioUrl: unavailableAudio('fr-ordering-politely-prompt'),
            transcript: 'You want to order a coffee politely in French. What do you say?',
            contentProvenance: 'ORIGINAL',
          },
          {
            id: 'fr-ordering-politely-answer',
            type: 'ANSWER',
            position: 2,
            pauseAfter: false,
            audioUrl: unavailableAudio('fr-ordering-politely-answer'),
            transcript: 'Je voudrais un café, s’il vous plaît.',
            contentProvenance: 'ORIGINAL',
          },
        ],
        drills: [
          {
            id: 'fr-ordering-politely-drill',
            conceptId: 'fr-ordering-politely',
            cefrLevel: 'A1',
            kind: 'TRANSFORMATION',
            prompt: 'Order a coffee politely in French.',
            acceptedResponses: ['Je voudrais un café, s’il vous plaît.'],
            recallTarget: 'Je voudrais un café, s’il vous plaît.',
            contentProvenance: 'ORIGINAL',
          },
        ],
      },
    ],
  },
  {
    slug: 'english-to-italian',
    sourceLanguageCode: 'en',
    targetLanguageCode: 'it',
    title: 'English to Italian: A1 patterns',
    description: 'Original A1 demonstrations for using practical Italian patterns.',
    concepts: [
      {
        id: 'it-ordering-politely',
        position: 1,
        cefrLevel: 'A1',
        title: 'Italian: ordering politely with “Vorrei…”',
        explanation:
          'Use “Vorrei un caffè, per favore.” to order a coffee politely in Italian.',
        assessmentCriteria:
          'Say the full Italian sentence for ordering a coffee politely without seeing the answer.',
        contentProvenance: 'ORIGINAL',
        audioSegments: [
          {
            id: 'it-ordering-politely-prompt',
            type: 'PROMPT',
            position: 1,
            pauseAfter: true,
            audioUrl: unavailableAudio('it-ordering-politely-prompt'),
            transcript: 'You want to order a coffee politely in Italian. What do you say?',
            contentProvenance: 'ORIGINAL',
          },
          {
            id: 'it-ordering-politely-answer',
            type: 'ANSWER',
            position: 2,
            pauseAfter: false,
            audioUrl: unavailableAudio('it-ordering-politely-answer'),
            transcript: 'Vorrei un caffè, per favore.',
            contentProvenance: 'ORIGINAL',
          },
        ],
        drills: [
          {
            id: 'it-ordering-politely-drill',
            conceptId: 'it-ordering-politely',
            cefrLevel: 'A1',
            kind: 'TRANSFORMATION',
            prompt: 'Order a coffee politely in Italian.',
            acceptedResponses: ['Vorrei un caffè, per favore.'],
            recallTarget: 'Vorrei un caffè, per favore.',
            contentProvenance: 'ORIGINAL',
          },
        ],
      },
    ],
  },
] as const satisfies readonly CourseFixture[];
