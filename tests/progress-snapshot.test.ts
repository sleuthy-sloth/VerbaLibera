import { describe, it, expect } from 'vitest';

import { getProgressSnapshot } from '../src/lib/progress/snapshot';
import { demoProgress } from '../src/features/progress/demo-progress';

describe('progress snapshot', () => {
  it('returns demoProgress for signed-out (null user)', async () => {
    const snapshot = await getProgressSnapshot(null);
    expect(snapshot).toEqual(demoProgress);
  });

  it('returns demoProgress for undefined user', async () => {
    const snapshot = await getProgressSnapshot(null);
    // Should be byte-identical to demoProgress for preview
    expect(snapshot.selectedCourseSlug).toBe(demoProgress.selectedCourseSlug);
    expect(snapshot.xp).toBe(demoProgress.xp);
    expect(snapshot.dailyGoal).toEqual(demoProgress.dailyGoal);
  });

  it('has same structure as demoProgress', async () => {
    const snapshot = await getProgressSnapshot(null);
    expect(snapshot.courses).toBeDefined();
    expect(snapshot.session).toBeDefined();
    expect(Array.isArray(snapshot.courses)).toBe(true);
    expect(Array.isArray(snapshot.session)).toBe(true);
  });
});
