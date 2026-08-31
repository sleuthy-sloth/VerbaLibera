import type { CourseFixture } from './types';

const unavailableAudio = (id: string) => `unavailable://original-demo/${id}`;

export const initialCourses = [
  {
    slug: 'english-to-french',
    sourceLanguageCode: 'en',
    targetLanguageCode: 'fr',
    title: 'English to French: A1 patterns',
    description: 'Original A1 demonstrations for noticing French word-building patterns.',
    concepts: [
      {
        id: 'fr-tion-information',
        position: 1,
        cefrLevel: 'A1',
        title: 'French -tion cognates',
        explanation:
          'Many English words ending in -tion have a closely related French form ending in -tion.',
        assessmentCriteria:
          'Build the French cognate for a familiar English -tion word without seeing the answer.',
        contentProvenance: 'ORIGINAL',
        audioSegments: [
          {
            id: 'fr-tion-information-prompt',
            type: 'PROMPT',
            position: 1,
            pauseAfter: true,
            audioUrl: unavailableAudio('fr-tion-information-prompt'),
            transcript: 'How would you make information in French?',
            contentProvenance: 'ORIGINAL',
          },
          {
            id: 'fr-tion-information-answer',
            type: 'ANSWER',
            position: 2,
            pauseAfter: false,
            audioUrl: unavailableAudio('fr-tion-information-answer'),
            transcript: 'information',
            contentProvenance: 'ORIGINAL',
          },
        ],
        drills: [
          {
            id: 'fr-tion-information-drill',
            conceptId: 'fr-tion-information',
            cefrLevel: 'A1',
            kind: 'TRANSFORMATION',
            prompt: 'Transform the English word “information” into its French cognate.',
            acceptedResponses: ['information'],
            recallTarget: 'information',
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
    description: 'Original A1 demonstrations for noticing Italian word-building patterns.',
    concepts: [
      {
        id: 'it-zione-informazione',
        position: 1,
        cefrLevel: 'A1',
        title: 'Italian -zione cognates',
        explanation:
          'Many English words ending in -tion have a related Italian form ending in -zione.',
        assessmentCriteria:
          'Build the Italian cognate for a familiar English -tion word without seeing the answer.',
        contentProvenance: 'ORIGINAL',
        audioSegments: [
          {
            id: 'it-zione-informazione-prompt',
            type: 'PROMPT',
            position: 1,
            pauseAfter: true,
            audioUrl: unavailableAudio('it-zione-informazione-prompt'),
            transcript: 'How would you make information in Italian?',
            contentProvenance: 'ORIGINAL',
          },
          {
            id: 'it-zione-informazione-answer',
            type: 'ANSWER',
            position: 2,
            pauseAfter: false,
            audioUrl: unavailableAudio('it-zione-informazione-answer'),
            transcript: 'informazione',
            contentProvenance: 'ORIGINAL',
          },
        ],
        drills: [
          {
            id: 'it-zione-informazione-drill',
            conceptId: 'it-zione-informazione',
            cefrLevel: 'A1',
            kind: 'TRANSFORMATION',
            prompt: 'Transform the English word “information” into its Italian cognate.',
            acceptedResponses: ['informazione'],
            recallTarget: 'informazione',
            contentProvenance: 'ORIGINAL',
          },
        ],
      },
    ],
  },
] as const satisfies readonly CourseFixture[];
