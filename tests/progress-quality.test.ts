import { describe, it, expect } from 'vitest';

import { qualityFromVerdict } from '../src/lib/progress/quality';

describe('qualityFromVerdict', () => {
  it('maps exact + fast to 5', () => {
    expect(qualityFromVerdict('exact', 1000)).toBe(5);
    expect(qualityFromVerdict('exact', 2999)).toBe(5);
  });

  it('maps exact + 3-8s to 4', () => {
    expect(qualityFromVerdict('exact', 3000)).toBe(4);
    expect(qualityFromVerdict('exact', 8000)).toBe(4);
  });

  it('maps exact + >8s to 3', () => {
    expect(qualityFromVerdict('exact', 8001)).toBe(3);
    expect(qualityFromVerdict('exact', 20000)).toBe(3);
  });

  it('maps close + fast to 3', () => {
    expect(qualityFromVerdict('close', 1000)).toBe(3);
  });

  it('maps close + 3-8s to 2', () => {
    expect(qualityFromVerdict('close', 5000)).toBe(2);
  });

  it('maps close + >8s to 1', () => {
    expect(qualityFromVerdict('close', 9000)).toBe(1);
  });

  it('maps try_again to 0 regardless of latency', () => {
    expect(qualityFromVerdict('try_again', 1000)).toBe(0);
    expect(qualityFromVerdict('try_again', null)).toBe(0);
    expect(qualityFromVerdict('try_again', 8000)).toBe(0);
  });

  it('handles null latency for exact/close', () => {
    expect(qualityFromVerdict('exact', null)).toBe(3);
    expect(qualityFromVerdict('close', null)).toBe(1);
  });
});
