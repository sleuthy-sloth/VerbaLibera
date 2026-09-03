const DAY_MS = 86_400_000;

function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today (or yesterday — a streak stays alive
 * until the end of the day after the last activity). Inputs are UTC
 * `YYYY-MM-DD` strings; comparison is calendar-day based, never local.
 */
export function computeStreak(activeDaysUtc: readonly string[], todayUtc: Date = new Date()): number {
  const active = new Set(activeDaysUtc);
  if (active.size === 0) return 0;
  const today = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()));
  const todayKey = dayString(today);
  const yesterdayKey = dayString(new Date(today.getTime() - DAY_MS));
  if (!active.has(todayKey) && !active.has(yesterdayKey)) return 0;
  let streak = 0;
  let cursor = active.has(todayKey) ? today : new Date(today.getTime() - DAY_MS);
  while (active.has(dayString(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}
