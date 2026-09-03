import 'server-only';

import { demoProgress } from '@/features/progress/demo-progress';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { composeDailySession } from '@/features/session/compose-session';
import type { SessionStep } from '@/features/session/compose-session';
import { computeStreak } from '@/features/srs/streaks';
import { prisma } from '@/lib/prisma';

async function fetchContentVersion(): Promise<string | null> {
  try {
    const record = await prisma.contentVersion.findUnique({
      where: { id: 'fixtures' },
      select: { version: true },
    });
    if (record?.version) return record.version;
  } catch {
    // DB not configured or query failed — fall back to null
  }
  return null;
}

export async function getProgressSnapshot(userId: string | null): Promise<DemoProgressSnapshot> {
  const contentVersion = await fetchContentVersion();
  // UTC snapshot time — must be ISO-8601 UTC (toISOString), never server-local string.
  // Used for due-queue staleness proof: dueAt (UTC epoch) <= now (UTC) vs. snapshotAt.
  const snapshotAt = new Date().toISOString();
  const now = new Date(snapshotAt);

  if (!userId) {
    // Signed-out preview: demoProgress is byte-identical for everyone,
    // but we expose contentVersion and snapshotAt for debug badge (?debug=1).
    return { ...demoProgress, contentVersion, snapshotAt };
  }

  // For signed-in users, compose from UserProgress rows
  const dueCount = await prisma.userProgress.count({
    where: {
      userId,
      dueAt: { lte: now },
    },
  });

  const totalProgress = await prisma.userProgress.count({
    where: { userId },
  });

  // Streak from distinct UTC activity days (review log); quiet today is fine
  // if yesterday was active — computeStreak owns that rule.
  let streakDays = 0;
  try {
    const activity = await prisma.reviewLog.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 365,
    });
    streakDays = computeStreak(
      activity.map((entry) => entry.createdAt.toISOString().slice(0, 10)),
      now,
    );
  } catch {
    streakDays = 0;
  }

  // Simple derivation: dailyGoal completed is min(dueCount, target) or based on progress?
  // For now, use demoProgress as base but override dueReviewCount and xp
  const base = demoProgress;
  const xp = base.xp + totalProgress * 10; // derived from fiction math: demoProgress.xp + 10 XP per reviewed item
  const completed = Math.min(dueCount, base.dailyGoal.target);

  return {
    ...base,
    dueReviewCount: dueCount,
    xp,
    streakDays,
    session: await buildSignedInSession(userId, now, base.session),
    dailyGoal: { ...base.dailyGoal, completed },
    contentVersion,
    snapshotAt,
  };
}

/**
 * Prefer the learner's own SRS-due items: due UserProgress rows become REVIEW
 * steps ahead of the fixture drill rounds, per course. Falls back to the
 * demo session when nothing is due (or the query fails).
 */
async function buildSignedInSession(
  userId: string,
  now: Date,
  fallback: DemoProgressSnapshot['session'],
): Promise<readonly SessionStep[]> {
  let dueRows: {
    drillItemId: string;
    drillItem: { conceptBlock: { id: string; course: { slug: string } } };
  }[];
  try {
    dueRows = (await prisma.userProgress.findMany({
      where: { userId, dueAt: { lte: now } },
      include: { drillItem: { include: { conceptBlock: { include: { course: true } } } } },
      orderBy: { dueAt: 'asc' },
      take: 12,
    })) as typeof dueRows;
  } catch {
    return fallback;
  }
  if (dueRows.length === 0) return fallback;

  const byCourse = new Map<string, typeof dueRows>();
  for (const row of dueRows) {
    const slug = row.drillItem.conceptBlock.course.slug;
    byCourse.set(slug, [...(byCourse.get(slug) ?? []), row]);
  }

  const courseOrder: string[] = [];
  for (const step of fallback) {
    if (!courseOrder.includes(step.courseSlug)) courseOrder.push(step.courseSlug);
  }

  return courseOrder.flatMap((courseSlug) => {
    const rows = byCourse.get(courseSlug) ?? [];
    const baseSteps = fallback.filter((step) => step.courseSlug === courseSlug);
    if (rows.length === 0) return baseSteps;
    const dueReviews = rows.slice(0, 4).map((row, index) => ({
      id: `${row.drillItemId}-review-${index}`,
      contentId: row.drillItem.conceptBlock.id,
    }));
    const drillRounds = baseSteps
      .filter((step) => step.kind === 'DRILL')
      .map((step) => ({
        id: step.id,
        contentId: step.contentId,
        drillId: (step as { drillId?: string }).drillId ?? step.contentId,
      }));
    const newPattern = baseSteps.find((step) => step.kind === 'NEW_PATTERN');
    return composeDailySession({
      courseSlug,
      dueReviews,
      drillRounds,
      newPattern: newPattern ? { id: newPattern.id, contentId: newPattern.contentId } : null,
      maxSteps: 8,
    });
  });
}

export async function getContentVersion(): Promise<string | null> {
  return fetchContentVersion();
}
