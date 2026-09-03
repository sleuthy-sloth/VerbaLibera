import { describe, it, expect } from 'vitest';

import { isPublicPath, isProtectedMutation } from '../proxy';

describe('proxy guard', () => {
  it('allows public paths', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/learn')).toBe(true);
    expect(isPublicPath('/learn/fr')).toBe(true);
    expect(isPublicPath('/api/answer-check')).toBe(true);
    expect(isPublicPath('/api/demo/progress')).toBe(true);
    expect(isPublicPath('/api/auth/register')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
  });

  it('marks protected mutations', () => {
    expect(isProtectedMutation('/api/progress/review', 'POST')).toBe(true);
    expect(isProtectedMutation('/api/progress/review', 'GET')).toBe(false);
    expect(isProtectedMutation('/account', 'POST')).toBe(true);
    expect(isProtectedMutation('/account', 'GET')).toBe(false);
    expect(isProtectedMutation('/', 'POST')).toBe(false);
    expect(isProtectedMutation('/api/answer-check', 'POST')).toBe(false);
  });

  it('treats unknown api as not protected (except progress)', () => {
    expect(isProtectedMutation('/api/other', 'POST')).toBe(false);
    expect(isProtectedMutation('/api/demo/progress', 'POST')).toBe(false);
  });
});
