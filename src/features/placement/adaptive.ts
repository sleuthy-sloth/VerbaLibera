import { initialCourses } from '@/features/curriculum/fixture';
import type { CEFRLevel } from '@/features/curriculum/types';
import type { PlacementItem } from './items';
import { isPlacementCorrect, type PlacementResult } from './score';

const CHECKPOINT_SIZE = 3;
const CHECKPOINTS = ['A1', 'A2', 'B1'] as const;

type CheckpointBand = (typeof CHECKPOINTS)[number];

function checkpointItems(items: readonly PlacementItem[], band: CheckpointBand): readonly PlacementItem[] {
  return items.filter((item) => item.band === band).slice(0, CHECKPOINT_SIZE);
}

function correctCount(items: readonly PlacementItem[], answers: Record<string, string>): number {
  return items.filter((item) => isPlacementCorrect(item, answers[item.id] ?? '')).length;
}

function hasStrongEvidence(items: readonly PlacementItem[], answers: Record<string, string>): boolean {
  return correctCount(items, answers) >= 2;
}

function startConceptIdFor(courseSlug: string): string {
  return initialCourses.find((course) => course.slug === courseSlug)?.concepts[0]?.id ?? '';
}

function result(
  band: PlacementResult['band'],
  startCefr: CEFRLevel,
  answers: Record<string, string>,
  items: readonly PlacementItem[],
  courseSlug: string,
): PlacementResult {
  const attempted = items.filter((item) => Object.hasOwn(answers, item.id));
  const score = correctCount(attempted, answers);
  const aboveContent = band === 'B1+';
  return {
    score,
    total: attempted.length,
    band,
    startCefr,
    startConceptId: startConceptIdFor(courseSlug),
    stretchUnlocked: startCefr !== 'A1',
    aboveContent,
  };
}

// Adaptive ladder: learners only see a higher checkpoint after demonstrating
// strong evidence at the preceding one. This keeps the diagnostic short for
// beginners while still making room for experienced learners to place above A1.
export function nextAdaptivePlacementItem(
  items: readonly PlacementItem[],
  answers: Record<string, string>,
  completedItemIds: readonly string[],
): PlacementItem | null {
  for (const band of CHECKPOINTS) {
    const checkpoint = checkpointItems(items, band);
    const completed = checkpoint.filter((item) => completedItemIds.includes(item.id));
    const next = checkpoint.find((item) => !completedItemIds.includes(item.id));
    if (next) return next;
    if (!hasStrongEvidence(completed, answers)) return null;
  }
  return null;
}

export function scoreAdaptivePlacement(
  items: readonly PlacementItem[],
  answers: Record<string, string>,
  courseSlug = 'english-to-french',
): PlacementResult {
  const a1 = checkpointItems(items, 'A1');
  if (a1.some((item) => !Object.hasOwn(answers, item.id)) || !hasStrongEvidence(a1, answers)) {
    return result('A1', 'A1', answers, a1, courseSlug);
  }

  const a2 = checkpointItems(items, 'A2');
  if (a2.some((item) => !Object.hasOwn(answers, item.id)) || !hasStrongEvidence(a2, answers)) {
    return result('A2', 'A2', answers, [...a1, ...a2], courseSlug);
  }

  const b1 = checkpointItems(items, 'B1');
  if (b1.some((item) => !Object.hasOwn(answers, item.id))) {
    return result('B1', 'B1', answers, [...a1, ...a2, ...b1], courseSlug);
  }
  return hasStrongEvidence(b1, answers)
    ? result('B1+', 'B1', answers, [...a1, ...a2, ...b1], courseSlug)
    : result('B1', 'B1', answers, [...a1, ...a2, ...b1], courseSlug);
}
