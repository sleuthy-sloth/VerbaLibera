import { canAccessDrill } from '@/features/curriculum/access-policy';

describe('canAccessDrill', () => {
  it('requires mastery of the drill’s exact concept', () => {
    expect(
      canAccessDrill({
        drillConceptId: 'fr-cognates',
        masteredConceptIds: ['it-cognates'],
      }),
    ).toBe(false);
    expect(
      canAccessDrill({
        drillConceptId: 'fr-cognates',
        masteredConceptIds: ['fr-cognates'],
      }),
    ).toBe(true);
  });
});
