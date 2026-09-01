import { resolveSessionContent } from '@/features/session/resolve-session-content';

describe('resolveSessionContent', () => {
  it('resolves a drill step to its own pattern instead of the first pattern', () => {
    expect(resolveSessionContent('english-to-french', 'fr-find-place', 'fr-find-place-drill')).toMatchObject({
      concept: { id: 'fr-find-place' },
      drill: { id: 'fr-find-place-drill' },
    });
  });

  it('returns null for a missing pattern', () => {
    expect(resolveSessionContent('english-to-french', 'missing-pattern')).toBeNull();
  });

  it('returns null for a drill that does not belong to the pattern', () => {
    expect(resolveSessionContent('english-to-french', 'fr-find-place', 'fr-ordering-politely-drill')).toBeNull();
  });
});
