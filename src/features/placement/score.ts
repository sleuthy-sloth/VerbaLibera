import { initialCourses } from '@/features/curriculum/fixture';
import type { CEFRLevel } from '@/features/curriculum/types';
import type { PlacementItem } from './items';

export type PlacementBand = 'A1' | 'A2' | 'B1' | 'B1+';

export type PlacementResult = Readonly<{
  score: number;
  total: number;
  band: PlacementBand;
  startCefr: CEFRLevel;
  startConceptId: string;
  stretchUnlocked: boolean;
  aboveContent: boolean;
}>;

export function isPlacementCorrect(item: PlacementItem, answer: string): boolean {
  if (item.kind === 'CHOICE') return answer === item.answerKey;
  // Placement sorts roughly: fold accents so mobile keyboards without
  // diacritics still place correctly. Drills stay strict on purpose.
  // Local copy of the server checker's normalization: lib/answer-checking
  // is server-only, and placement must grade in the browser for guests.
  const normalize = (text: string) =>
    text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/'/g, '’')
      .toLowerCase()
      .replace(/^["'‘’]+|["'‘’]+$/g, '')
      .replace(/[.!?]+$/, '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  const normalized = normalize(answer);
  return item.acceptedResponses.some((variant) => normalize(variant) === normalized);
}

function startConceptIdFor(courseSlug: string): string {
  const course = initialCourses.find((candidate) => candidate.slug === courseSlug);
  return course?.concepts[0]?.id ?? '';
}

// Bands: 0–5 A1, 6–10 A2, 11–13 B1, 14–15 above current content.
// A2/B1 starts fall back to the course beginning with stretch drills
// unlocked until leveled content exists — the UI states this plainly.
export function scorePlacement(
  items: readonly PlacementItem[],
  answers: Record<string, string>,
  courseSlug = 'english-to-french',
): PlacementResult {
  const score = items.filter((item) => isPlacementCorrect(item, answers[item.id] ?? '')).length;
  const startConceptId = startConceptIdFor(courseSlug);
  const base = { score, total: items.length, startConceptId, stretchUnlocked: false, aboveContent: false } as const;
  if (score <= 5) return { ...base, band: 'A1', startCefr: 'A1' };
  if (score <= 10) return { ...base, band: 'A2', startCefr: 'A2', stretchUnlocked: true };
  if (score <= 13) return { ...base, band: 'B1', startCefr: 'B1', stretchUnlocked: true };
  return { ...base, band: 'B1+', startCefr: 'B1', stretchUnlocked: true, aboveContent: true };
}
