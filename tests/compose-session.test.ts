import { composeDailySession } from '@/features/session/compose-session';

const input = {
  courseSlug: 'english-to-french',
  dueReviews: [{ id: 'review-1', contentId: 'content-1' }],
  drillRounds: [
    { id: 'drill-1', contentId: 'content-2', drillId: 'drill-content-2' },
    { id: 'drill-2', contentId: 'content-3', drillId: 'drill-content-3' },
  ],
  newPattern: { id: 'pattern-1', contentId: 'content-4' },
  maxSteps: 4,
} as const;

describe('composeDailySession', () => {
  it('places due reviews before the drill round and admits one new pattern when capacity remains', () => {
    // Break caught: scheduling practice in an order that skips due reviews.
    expect(composeDailySession(input)).toEqual([
      { id: 'review-1', kind: 'REVIEW', courseSlug: 'english-to-french', contentId: 'content-1' },
      { id: 'drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'content-2', drillId: 'drill-content-2' },
      { id: 'drill-2', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'content-3', drillId: 'drill-content-3' },
      { id: 'pattern-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french', contentId: 'content-4' },
    ]);
  });

  it('omits a new pattern when reviews and drills exhaust the session capacity', () => {
    // Break caught: exceeding the learner's daily session capacity.
    expect(composeDailySession({ ...input, maxSteps: 3 }).map((step) => step.kind)).toEqual([
      'REVIEW', 'DRILL', 'DRILL',
    ]);
  });

  it('returns no steps when capacity is zero or negative', () => {
    // Break caught: negative capacity allowing reviews through slice's negative-index behavior.
    expect(composeDailySession({ ...input, maxSteps: 0 })).toEqual([]);
    expect(composeDailySession({ ...input, maxSteps: -1 })).toEqual([]);
  });

  it('rounds fractional capacity down before scheduling steps', () => {
    // Break caught: fractional capacity admitting more steps than the stated bound.
    expect(composeDailySession({ ...input, maxSteps: 2.5 })).toEqual([
      { id: 'review-1', kind: 'REVIEW', courseSlug: 'english-to-french', contentId: 'content-1' },
      { id: 'drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'content-2', drillId: 'drill-content-2' },
    ]);
  });

  it('never carries a drill ID on review or new-pattern steps', () => {
    const withInvalidDrillIds = {
      ...input,
      dueReviews: [{ id: 'review-1', contentId: 'content-1', drillId: 'wrong-review-drill' }],
      newPattern: { id: 'pattern-1', contentId: 'content-4', drillId: 'wrong-new-drill' },
    } as never;
    expect(composeDailySession(withInvalidDrillIds)).toEqual([
      { id: 'review-1', kind: 'REVIEW', courseSlug: 'english-to-french', contentId: 'content-1' },
      { id: 'drill-1', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'content-2', drillId: 'drill-content-2' },
      { id: 'drill-2', kind: 'DRILL', courseSlug: 'english-to-french', contentId: 'content-3', drillId: 'drill-content-3' },
      { id: 'pattern-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french', contentId: 'content-4' },
    ]);
  });
});
