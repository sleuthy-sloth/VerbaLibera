import 'server-only';

import { initialCourses } from '@/features/curriculum/fixture';
import { demoProgress } from '@/features/progress/demo-progress';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { composeLessonSession } from '@/features/session/lesson-path';
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

  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const [totalReviews, todayReviews, masteries] = await Promise.all([
    prisma.reviewLog.count({ where: { userId } }),
    prisma.reviewLog.count({ where: { userId, createdAt: { gte: today, lte: now } } }),
    prisma.conceptMastery.findMany({ where: { userId }, select: { conceptBlockId: true } }),
  ]);
  const mastered = new Set(masteries.map(row => row.conceptBlockId));

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

  const base = demoProgress;
  const xp = totalReviews * 10;
  const completed = Math.min(todayReviews, base.dailyGoal.target);

  return {
    ...base,
    isPreview: false,
    practiceFlowDays: streakDays,
    courses: initialCourses.map(course => ({
      slug: course.slug,
      title: course.title,
      unitLabel: `Unit 1: ${course.concepts[0]?.scenario ?? 'Patterns'}`,
      completionPercent: Math.round(100 * course.concepts.filter(c => mastered.has(c.id)).length / Math.max(1, course.concepts.length)),
    })),
    dueReviewCount: dueCount,
    xp,
    streakDays,
    session: await buildSignedInSession(userId, now, base.session),
    dailyGoal: { ...base.dailyGoal, completed },
    contentVersion,
    snapshotAt,
  };
}

async function buildSignedInSession(
  userId: string,
  now: Date,
  _fallback: DemoProgressSnapshot['session'],
): Promise<readonly SessionStep[]> {
  const practiced = await prisma.userProgress.findMany({ where: { userId } });
  const completed = new Set(practiced.filter(row => (row.lastQuality ?? 0) >= 3).map(row => row.drillItemId));
  return initialCourses.flatMap(course => {
    const next = course.concepts.find(concept => !completed.has(`${concept.id}-drill`));
    const steps = next ? [...composeLessonSession(course, next.id)] : [];
    const due = practiced.filter(row => row.dueAt <= now && course.concepts.some(concept => concept.drills.some(drill => drill.id === row.drillItemId)))
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()).slice(0, 4);
    const reviews = due.map(row => ({
      id: `${row.drillItemId}-due`, kind: 'DRILL' as const, courseSlug: course.slug,
      contentId: course.concepts.find(concept => concept.drills.some(drill => drill.id === row.drillItemId))!.id,
      drillId: row.drillItemId,
    }));
    // A new lesson teaches first; reviews already encountered by this learner follow.
    return [...steps, ...reviews];
  });
}

export async function getContentVersion(): Promise<string | null> {
  return fetchContentVersion();
}
