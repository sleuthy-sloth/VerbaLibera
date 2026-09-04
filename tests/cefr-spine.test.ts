import { cefrCoverage, CEFR_LEVELS, isCefrLevel } from '@/features/curriculum/cefr';
import { initialCourses } from '@/features/curriculum/fixture';

describe('CEFR spine', () => {
  it('tags every concept and drill with a valid CEFR level', () => {
    for (const course of initialCourses) {
      for (const concept of course.concepts) {
        expect(isCefrLevel(concept.cefrLevel)).toBe(true);
        for (const drill of concept.drills) {
          expect(isCefrLevel(drill.cefrLevel)).toBe(true);
        }
      }
    }
  });

  it('reports the honest current coverage: A1 base with first B1 stretch drills', () => {
    const coverage = cefrCoverage(initialCourses);
    expect(coverage.concepts).toEqual({ A1: 32, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 });
    expect(coverage.drills.B1).toBe(2);
    expect(coverage.drills.A1).toBeGreaterThan(100);
    expect(CEFR_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });
});
