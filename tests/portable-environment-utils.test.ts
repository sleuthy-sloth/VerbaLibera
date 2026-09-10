import { describe, expect, it } from 'vitest';
import { resolveNextStepForType } from '@/features/course-pack/portable-environment';

function makeLessonStub(steps: { exercise?: { type?: string } }[], start = 0) {
  return {
    start,
    length: steps.length,
    steps,
    getNextStepIndex: (step: number) => (step < steps.length - 1 ? step + 1 : step),
  };
}

describe('resolveNextStepForType', () => {
  it('returns a valid index for a notice exercise', () => {
    const lesson = makeLessonStub([
      { exercise: { type: 'notice' } },
      { exercise: { type: 'cloze' } },
    ]);
    const result = resolveNextStepForType(lesson, 0, 'notice');
    expect(result).toBe(0);
  });

  it('skips ahead when a meaning step is expected but not present in the current run', () => {
    const lesson = makeLessonStub([
      { exercise: { type: 'notice' } },
      { exercise: { type: 'cloze' } },
      { exercise: { type: 'order' } },
      { exercise: { type: 'reading' } },
    ]);
    const result = resolveNextStepForType(lesson, 0, 'meaning');
    expect(result).toBe(3);
  });

  it('returns the original index when the type is not recognized', () => {
    const lesson = makeLessonStub([{ exercise: {} }]);
    const result = resolveNextStepForType(lesson, 0, 'unknown');
    expect(result).toBe(0);
  });

  it('clamps to the last step if no matching type is found after the current position', () => {
    const lesson = makeLessonStub([
      { exercise: { type: 'notice' } },
      { exercise: { type: 'cloze' } },
    ]);
    const result = resolveNextStepForType(lesson, 0, 'meaning');
    expect(result).toBe(1);
  });
});