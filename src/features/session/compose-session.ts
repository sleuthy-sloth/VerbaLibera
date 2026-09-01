export type SessionStepKind = 'REVIEW' | 'DRILL' | 'NEW_PATTERN';

export type SessionCandidate = Readonly<{ id: string; contentId: string }>;
export type DrillSessionCandidate = SessionCandidate & Readonly<{ drillId: string }>;

type SessionStepBase = Readonly<{
  id: string;
  courseSlug: string;
  contentId: string;
}>;

export type SessionStep =
  | (SessionStepBase & Readonly<{ kind: 'REVIEW' | 'NEW_PATTERN' }>)
  | (SessionStepBase & Readonly<{ kind: 'DRILL'; drillId: string }>);

export type DailySessionInput = Readonly<{
  courseSlug: string;
  dueReviews: readonly SessionCandidate[];
  drillRound: DrillSessionCandidate | null;
  newPattern: SessionCandidate | null;
  maxSteps: number;
}>;

export function composeDailySession(input: DailySessionInput): readonly SessionStep[] {
  const maxSteps = Number.isFinite(input.maxSteps) ? Math.max(0, Math.floor(input.maxSteps)) : 0;
  const steps: SessionStep[] = input.dueReviews.slice(0, maxSteps).map((review) => ({
    id: review.id,
    kind: 'REVIEW',
    courseSlug: input.courseSlug,
    contentId: review.contentId,
  }));

  if (steps.length < maxSteps && input.drillRound) {
    steps.push({
      id: input.drillRound.id,
      kind: 'DRILL',
      courseSlug: input.courseSlug,
      contentId: input.drillRound.contentId,
      drillId: input.drillRound.drillId,
    });
  }

  if (steps.length < maxSteps && input.newPattern) {
    steps.push({
      id: input.newPattern.id,
      kind: 'NEW_PATTERN',
      courseSlug: input.courseSlug,
      contentId: input.newPattern.contentId,
    });
  }

  return steps;
}
