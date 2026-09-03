import { describe, it, expect } from 'vitest';

import { dashboardBadgeCopy, isPreviewMode, sessionCompletionCopy } from '../src/lib/progress/copy';

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

  it('exposes canonical preview/saved badge copy', () => {
    expect(dashboardBadgeCopy({ isPreview: true })).toBe('Preview progress');
    expect(dashboardBadgeCopy({ isPreview: false })).toBe('Saved to your account');
    expect(sessionCompletionCopy({ isPreview: true })).toBe('Nothing was saved.');
    expect(sessionCompletionCopy({ isPreview: false })).toBe('Saved to your account.');
  });

  it('exposes canonical badge and completion copy via object param (case-insensitive)', () => {
    expect(dashboardBadgeCopy({ isPreview: true })).toMatch(/Preview progress/i);
    expect(dashboardBadgeCopy({ isPreview: false })).toMatch(/Saved to your account/i);
    expect(sessionCompletionCopy({ isPreview: true })).toMatch(/Nothing was saved/i);
  });
});
