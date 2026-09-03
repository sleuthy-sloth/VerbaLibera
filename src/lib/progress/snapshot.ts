import 'server-only';

import { demoProgress } from '@/features/progress/demo-progress';
import type { DemoProgressSnapshot } from '@/features/progress/types';
import { prisma } from '@/lib/prisma';

export async function getProgressSnapshot(userId: string | null): Promise<DemoProgressSnapshot> {
  if (!userId) {
    return demoProgress;
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
  };
}
