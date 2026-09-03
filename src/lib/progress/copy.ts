export function isPreviewMode(session: { userId?: string | null } | null | undefined): boolean {
  return !session?.userId;
}

export function dashboardBadgeCopy(isPreview: boolean): string {
  return isPreview ? 'Preview progress' : 'Saved to your account';
}

export function progressNoticeCopy(isPreview: boolean): string {
  return isPreview ? 'Nothing was saved. Preview progress only.' : 'Saved to your account.';
}

export function sessionCompletionCopy(isPreview: boolean): string {
  // The answer-check verdict sentence "Checked locally. Nothing was saved." is always true for the check pipeline
  // But progress saved copy differs
  return isPreview ? 'Nothing was saved.' : 'Saved to your account.';
}

export function reviewQueueCopy(isPreview: boolean, dueCount: number): string {
  if (isPreview) {
    return dueCount === 0 ? 'You are caught up on reviews.' : `${dueCount} reviews waiting (preview)`;
  }
  return dueCount === 0 ? 'You are caught up on reviews.' : `${dueCount} reviews waiting`;
}

export function dailyGoalCopy(isPreview: boolean, completed: number, target: number): string {
  const label = `${completed} of ${target} daily steps`;
  return isPreview ? `${label} — preview` : label;
}
