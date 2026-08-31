export type SessionStepKind = 'REVIEW' | 'DRILL' | 'NEW_PATTERN';

export type SessionCandidate = Readonly<{ id: string }>;

export type SessionStep = Readonly<{
  id: string;
  kind: SessionStepKind;
  courseSlug: string;
}>;

export type DailySessionInput = Readonly<{
  courseSlug: string;
  dueReviews: readonly SessionCandidate[];
  drillRound: SessionCandidate | null;
  newPattern: SessionCandidate | null;
  maxSteps: number;
}>;

export function composeDailySession(input: DailySessionInput): readonly SessionStep[] {
  const maxSteps = Number.isFinite(input.maxSteps) ? Math.max(0, Math.floor(input.maxSteps)) : 0;
  const steps: SessionStep[] = input.dueReviews.slice(0, maxSteps).map((review) => ({
    id: review.id,
    kind: 'REVIEW',
    courseSlug: input.courseSlug,
  }));

  if (steps.length < maxSteps && input.drillRound) {
    steps.push({
      id: input.drillRound.id,
      kind: 'DRILL',
      courseSlug: input.courseSlug,
    });
  }

  if (steps.length < maxSteps && input.newPattern) {
    steps.push({
      id: input.newPattern.id,
      kind: 'NEW_PATTERN',
      courseSlug: input.courseSlug,
    });
  }

  return steps;
}
