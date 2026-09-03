import { describe, expect, it } from 'vitest';
import { computeStreak } from '@/features/srs/streaks';

const TODAY = new Date('2026-09-04T12:00:00Z');

describe('computeStreak', () => {
  it('returns 0 with no activity', () => {
    expect(computeStreak([], TODAY)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-09-02', '2026-09-03', '2026-09-04'], TODAY)).toBe(3);
  });

  it('keeps the streak alive when today is quiet but yesterday was active', () => {
    expect(computeStreak(['2026-09-02', '2026-09-03'], TODAY)).toBe(2);
  });

  it('breaks the streak after a missed day', () => {
    expect(computeStreak(['2026-09-01', '2026-09-04'], TODAY)).toBe(1);
    expect(computeStreak(['2026-09-01', '2026-09-02'], TODAY)).toBe(0);
  });

  it('dedupes repeat activity on the same day', () => {
    expect(computeStreak(['2026-09-04', '2026-09-04', '2026-09-03'], TODAY)).toBe(2);
  });
});
