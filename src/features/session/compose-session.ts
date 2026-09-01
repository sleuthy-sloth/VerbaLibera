export type SessionStepKind = 'REVIEW' | 'DRILL' | 'NEW_PATTERN';

export type SessionCandidate = Readonly<{ id: string; contentId: string; drillId?: string }>;

export type SessionStep = Readonly<{
  id: string;
  kind: SessionStepKind;
  courseSlug: string;
  contentId: string;
  drillId?: string;
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
    contentId: review.contentId,
    ...(review.drillId ? { drillId: review.drillId } : {}),
  }));

  if (steps.length < maxSteps && input.drillRound) {
    steps.push({
      id: input.drillRound.id,
      kind: 'DRILL',
      courseSlug: input.courseSlug,
      contentId: input.drillRound.contentId,
      ...(input.drillRound.drillId ? { drillId: input.drillRound.drillId } : {}),
    });
  }

  if (steps.length < maxSteps && input.newPattern) {
    steps.push({
      id: input.newPattern.id,
      kind: 'NEW_PATTERN',
      courseSlug: input.courseSlug,
      contentId: input.newPattern.contentId,
      ...(input.newPattern.drillId ? { drillId: input.newPattern.drillId } : {}),
    });
  }

  return steps;
}
