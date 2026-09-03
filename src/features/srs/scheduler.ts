export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export type SrsState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  lapseCount: number;
  lastReviewedAt: Date;
  lastQuality: ReviewQuality;
  lastLatencyMs: number | null;
};

const DAY_IN_MS = 86_400_000;
const MINIMUM_EASE_FACTOR = 1.3;

/**
 * Schedule the next review in UTC.
 * dueAt is computed as reviewedAt (UTC epoch millis) + intervalDays * 86_400_000,
 * so rollover occurs at UTC midnight, not server-local midnight.
 * Use toISOString() for serialization; never toLocaleString().
 */
export function scheduleReview(
  previous: SrsState,
  quality: ReviewQuality,
  reviewedAt: Date,
): SrsState {
  assertValidState(previous);
  assertReviewQuality(quality, 'quality');
  assertValidDate(reviewedAt, 'reviewedAt');

  const easeFactor = adjustedEaseFactor(previous.easeFactor, quality);
  const succeeded = quality >= 3;
  const repetitions = succeeded ? previous.repetitions + 1 : 0;
  const intervalDays = succeeded
    ? successfulIntervalDays(previous, repetitions, easeFactor)
    : 1;

  return {
    easeFactor,
    intervalDays,
    repetitions,
    // UTC: epoch millis + interval * 86_400_000; dueAt <= now is UTC comparison, not local
    dueAt: new Date(reviewedAt.getTime() + intervalDays * DAY_IN_MS),
    lapseCount: previous.lapseCount + (succeeded ? 0 : 1),
    lastReviewedAt: new Date(reviewedAt.getTime()),
    lastQuality: quality,
    lastLatencyMs: previous.lastLatencyMs,
  };
}

function successfulIntervalDays(
  previous: SrsState,
  repetitions: number,
  easeFactor: number,
): number {
  if (repetitions === 1) {
    return 1;
  }

  if (repetitions === 2) {
    return 6;
  }

  return Math.round(previous.intervalDays * easeFactor);
}

function adjustedEaseFactor(previousEaseFactor: number, quality: ReviewQuality): number {
  const difference = 5 - quality;
  const adjustment = 0.1 - difference * (0.08 + difference * 0.02);

  return Math.max(MINIMUM_EASE_FACTOR, previousEaseFactor + adjustment);
}

function assertValidState(state: SrsState): void {
  assertFiniteAtLeast(state.easeFactor, MINIMUM_EASE_FACTOR, 'easeFactor');
  assertNonnegativeInteger(state.intervalDays, 'intervalDays');
  assertNonnegativeInteger(state.repetitions, 'repetitions');
  assertValidDate(state.dueAt, 'dueAt');
  assertNonnegativeInteger(state.lapseCount, 'lapseCount');
  assertValidDate(state.lastReviewedAt, 'lastReviewedAt');
  assertReviewQuality(state.lastQuality, 'lastQuality');

  if (state.lastLatencyMs !== null) {
    assertFiniteAtLeast(state.lastLatencyMs, 0, 'lastLatencyMs');
  }
}

function assertReviewQuality(value: number, name: string): asserts value is ReviewQuality {
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new RangeError(`${name} must be an integer from 0 through 5`);
  }
}

function assertNonnegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative integer`);
  }
}

function assertFiniteAtLeast(value: number, minimum: number, name: string): void {
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${name} must be a finite number at least ${minimum}`);
  }
}

function assertValidDate(value: Date, name: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError(`${name} must be a valid date`);
  }
}
