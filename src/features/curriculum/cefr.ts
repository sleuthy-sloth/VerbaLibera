import type { CEFRLevel, CourseFixture } from './types';

export const CEFR_LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function isCefrLevel(value: unknown): value is CEFRLevel {
  return typeof value === 'string' && (CEFR_LEVELS as readonly string[]).includes(value);
}

export type CefrCoverage = Readonly<{
  concepts: Record<CEFRLevel, number>;
  drills: Record<CEFRLevel, number>;
}>;

function emptyCounts(): Record<CEFRLevel, number> {
  return { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
}

// Honest level accounting: every concept and drill counted by its tag,
// so the dashboard and docs can claim only what the coverage proves.
export function cefrCoverage(courses: readonly CourseFixture[]): CefrCoverage {
  const concepts = emptyCounts();
  const drills = emptyCounts();
  for (const course of courses) {
    for (const concept of course.concepts) {
      concepts[concept.cefrLevel] += 1;
      for (const drill of concept.drills) {
        drills[drill.cefrLevel] += 1;
      }
    }
  }
  return { concepts, drills };
}
