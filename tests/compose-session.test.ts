import { composeDailySession } from '@/features/session/compose-session';

const input = {
  courseSlug: 'english-to-french',
  dueReviews: [{ id: 'review-1' }, { id: 'review-2' }],
  drillRound: { id: 'drill-1' },
  newPattern: { id: 'pattern-1' },
  maxSteps: 4,
} as const;

describe('composeDailySession', () => {
  it('places due reviews before the drill round and admits one new pattern when capacity remains', () => {
    // Break caught: scheduling practice in an order that skips due reviews.
    expect(composeDailySession(input)).toEqual([
      { id: 'review-1', kind: 'REVIEW', courseSlug: 'english-to-french' },
      { id: 'review-2', kind: 'REVIEW', courseSlug: 'english-to-french' },
      { id: 'drill-1', kind: 'DRILL', courseSlug: 'english-to-french' },
      { id: 'pattern-1', kind: 'NEW_PATTERN', courseSlug: 'english-to-french' },
    ]);
  });

  it('omits a new pattern when reviews and drills exhaust the session capacity', () => {
    // Break caught: exceeding the learner's daily session capacity.
    expect(composeDailySession({ ...input, maxSteps: 3 }).map((step) => step.kind)).toEqual([
      'REVIEW', 'REVIEW', 'DRILL',
    ]);
  });
});
