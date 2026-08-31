import type { ReviewQuality } from './scheduler';

export function qualityFromConstruction(input: {
  isAccurate: boolean;
  latencyMs: number | null;
  targetLatencyMs: number;
}): ReviewQuality {
  assertPositiveFinite(input.targetLatencyMs, 'targetLatencyMs');

  if (input.latencyMs !== null) {
    assertNonnegativeFinite(input.latencyMs, 'latencyMs');
  }

  if (!input.isAccurate) {
    return 0;
  }

  if (input.latencyMs === null) {
    return 3;
  }

  if (input.latencyMs <= input.targetLatencyMs) {
    return 5;
  }

  if (input.latencyMs <= input.targetLatencyMs * 2) {
    return 4;
  }

  return 3;
}

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`);
  }
}

function assertNonnegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative finite number`);
  }
}
