import { describe, it, expect } from 'vitest';

import { dashboardBadgeCopy, isPreviewMode } from '../src/lib/progress/copy';

describe('progress copy', () => {
  it('detects preview mode from session', () => {
    expect(isPreviewMode(null)).toBe(true);
    expect(isPreviewMode(undefined)).toBe(true);
    expect(isPreviewMode({})).toBe(true);
    expect(isPreviewMode({ userId: null })).toBe(true);
    expect(isPreviewMode({ userId: 'user-123' })).toBe(false);
  });

  it('returns preview copy byte-identical to today for signed-out', () => {
    expect(dashboardBadgeCopy(true)).toBe('Preview progress');
    expect(dashboardBadgeCopy(false)).toBe('Saved to your account');
  });

  it('preserves preview copy for signed-out', () => {
    const preview = dashboardBadgeCopy(true);
    expect(preview).toBe('Preview progress');
    // Signed-in should differ
    expect(dashboardBadgeCopy(false)).not.toBe(preview);
  });
});
