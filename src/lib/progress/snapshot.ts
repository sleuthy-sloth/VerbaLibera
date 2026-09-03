import 'server-only';

import { demoProgress } from '@/features/progress/demo-progress';
import type { DemoProgressSnapshot } from '@/features/progress/types';
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

  if (!userId) {
    // Signed-out preview: demoProgress is byte-identical for everyone,
    // but we expose contentVersion for debug badge (?debug=1).
    return { ...demoProgress, contentVersion };
  }

  // For signed-in users, compose from UserProgress rows
  const now = new Date();
  const dueCount = await prisma.userProgress.count({
    where: {
      userId,
      dueAt: { lte: now },
    },
  });

  const totalProgress = await prisma.userProgress.count({
    where: { userId },
  });

  // Simple derivation: dailyGoal completed is min(dueCount, target) or based on progress?
  // For now, use demoProgress as base but override dueReviewCount and xp
  const base = demoProgress;
  const xp = 260 + totalProgress * 10; // simplistic: 10 XP per reviewed item
  const completed = Math.min(dueCount, base.dailyGoal.target);

  return {
    ...base,
    dueReviewCount: dueCount,
    xp,
    dailyGoal: { ...base.dailyGoal, completed },
    contentVersion,
  };
}

export async function getContentVersion(): Promise<string | null> {
  return fetchContentVersion();
}
