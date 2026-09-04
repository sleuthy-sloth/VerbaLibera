import type { ConceptFixture, CourseFixture } from '@/features/curriculum/types';
import { vocabWordFor } from '@/features/curriculum/fixture';

export const ANKI_MODEL_NAME = 'VerbaLibera';

export type AnkiMedia = Readonly<{
  filename: string;
  /** App-relative URL (e.g. /audio/french/fr-greet-politely-answer.wav) */
  sourceUrl: string;
  kind: 'audio' | 'image';
}>;

export type AnkiNote = Readonly<{
  /** Stable dedupe key → Anki's ID field (first field, re-push safe) */
  key: string;
  front: string;
  back: string;
}>;

export type AnkiDeck = Readonly<{
  deckName: string;
  modelName: string;
  tags: readonly string[];
  notes: readonly AnkiNote[];
  media: readonly AnkiMedia[];
}>;

export function deckNameFor(course: CourseFixture): string {
  const raw = course.slug.split('-').pop() ?? course.targetLanguageCode;
  return `VerbaLibera::${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

export function languageNameFor(course: CourseFixture): string {
  return deckNameFor(course).split('::')[1] ?? course.targetLanguageCode;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function basename(url: string): string {
  return url.split('/').pop() ?? url;
}

function isPlayableAudio(url: string | undefined): url is string {
  return typeof url === 'string' && url.length > 0 && !url.startsWith('unavailable://');
}

function soundTag(url: string | undefined, media: Map<string, AnkiMedia>): string {
  if (!isPlayableAudio(url)) return '';
  const filename = basename(url);
  if (!media.has(filename)) media.set(filename, { filename, sourceUrl: url, kind: 'audio' });
  return `[sound:${filename}]`;
}

function promptAudio(concept: ConceptFixture): string | undefined {
  return concept.audioSegments.find((segment) => segment.type === 'PROMPT')?.audioUrl;
}

function answerAudio(concept: ConceptFixture): string | undefined {
  return concept.audioSegments.find((segment) => segment.type === 'ANSWER')?.audioUrl;
}

/**
 * One-way card builder: fixture course → Anki deck.
 * WORD_ORDER drills are intentionally skipped (interactive-only, stay in-app).
 */
export function buildAnkiDeck(course: CourseFixture): AnkiDeck {
  const notes: AnkiNote[] = [];
  const media = new Map<string, AnkiMedia>();
  const language = languageNameFor(course);

  for (const concept of course.concepts) {
    const promptSound = soundTag(promptAudio(concept), media);
    const answerSound = soundTag(answerAudio(concept), media);

    notes.push({
      key: `verbalibera:${concept.id}:dialogue`,
      front: `${escapeHtml(concept.modelDialogue.prompt)}${promptSound ? `<br>${promptSound}` : ''}`,
      back: `${escapeHtml(concept.modelDialogue.answer)}${answerSound ? `<br>${answerSound}` : ''}`,
    });

    const recall = concept.drills.find(
      (drill) => drill.kind === 'SUBSTITUTION' || drill.kind === 'TRANSFORMATION',
    );
    if (recall) {
      notes.push({
        key: `verbalibera:${recall.id}:recall`,
        front: escapeHtml(recall.prompt),
        back: recall.acceptedResponses.map(escapeHtml).join('<br>'),
      });
    }

    notes.push({
      key: `verbalibera:${concept.id}:listen`,
      front: `Type what you hear.${answerSound ? `<br>${answerSound}` : ''}`,
      back: escapeHtml(concept.modelDialogue.answer),
    });

    const picture = concept.drills.find((drill) => drill.kind === 'PICTURE_CHOICE');
    for (const choice of picture?.choices ?? []) {
      const word = vocabWordFor(concept.id, choice.id);
      if (!word) continue;
      const filename = basename(choice.imageUrl);
      if (!media.has(filename)) {
        media.set(filename, { filename, sourceUrl: choice.imageUrl, kind: 'image' });
      }
      notes.push({
        key: `verbalibera:${concept.id}:vocab:${choice.id}`,
        front: `What is this in ${language}?<br><img src="${filename}" alt="${escapeHtml(choice.alt)}">`,
        back: escapeHtml(word),
      });
    }
  }

  return {
    deckName: deckNameFor(course),
    modelName: ANKI_MODEL_NAME,
    tags: ['verbalibera', course.slug],
    notes,
    media: [...media.values()],
  };
}
