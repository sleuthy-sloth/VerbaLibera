import { scheduleReview, type SrsState } from '@/features/srs/scheduler';

const reviewedAt = new Date('2026-08-30T23:30:00.000Z');

function state(overrides: Partial<SrsState> = {}): SrsState {
  return {
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: new Date('2026-08-29T23:30:00.000Z'),
    lapseCount: 0,
    lastReviewedAt: new Date('2026-08-29T23:30:00.000Z'),
    lastQuality: 0,
    lastLatencyMs: null,
    ...overrides,
  };
}

describe('scheduleReview', () => {
  it('uses one day for the first successful review', () => {
    const result = scheduleReview(state(), 4, reviewedAt);

    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
    expect(result.dueAt.toISOString()).toBe('2026-08-31T23:30:00.000Z');
  });

  it('uses six days for the second successful review', () => {
    const result = scheduleReview(state({ repetitions: 1, intervalDays: 1 }), 4, reviewedAt);

    expect(result.repetitions).toBe(2);
    expect(result.intervalDays).toBe(6);
    expect(result.dueAt.toISOString()).toBe('2026-09-05T23:30:00.000Z');
  });

  it('multiplies later successful intervals by the adjusted ease and rounds once', () => {
    const result = scheduleReview(state({ repetitions: 2, intervalDays: 6 }), 3, reviewedAt);

    expect(result.easeFactor).toBe(2.36);
    expect(result.intervalDays).toBe(14);
    expect(result.dueAt.toISOString()).toBe('2026-09-13T23:30:00.000Z');
  });

  it('resets failed reviews and schedules their retry one UTC day later', () => {
    const result = scheduleReview(
      state({ repetitions: 4, intervalDays: 20, lapseCount: 2 }),
      2,
      reviewedAt,
    );

    expect(result.repetitions).toBe(0);
    expect(result.intervalDays).toBe(1);
    expect(result.lapseCount).toBe(3);
    expect(result.dueAt.toISOString()).toBe('2026-08-31T23:30:00.000Z');
  });

  it('does not reduce ease below the SM-2 floor', () => {
    const result = scheduleReview(state({ easeFactor: 1.31 }), 0, reviewedAt);

    expect(result.easeFactor).toBe(1.3);
  });

  it('returns new state and date objects without mutating the previous state', () => {
    const previous = state();
    const result = scheduleReview(previous, 4, reviewedAt);

    expect(result).not.toBe(previous);
    expect(result.dueAt).not.toBe(previous.dueAt);
    expect(result.lastReviewedAt).not.toBe(reviewedAt);
    expect(previous).toMatchObject({
      repetitions: 0,
      intervalDays: 0,
      lapseCount: 0,
    });
    expect(previous.dueAt.toISOString()).toBe('2026-08-29T23:30:00.000Z');
  });

  it.each([
    ['a non-integer quality', 2.5],
    ['an out-of-range quality', 6],
  ])('rejects %s', (_description, quality) => {
    expect(() => scheduleReview(state(), quality as 0, reviewedAt)).toThrow('quality');
  });

  it('rejects invalid prior state', () => {
    expect(() => scheduleReview(state({ intervalDays: -1 }), 4, reviewedAt)).toThrow('intervalDays');
  });
});
