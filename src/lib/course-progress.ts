import 'server-only';
import { prisma } from './prisma';
import { mergeLearningEvents, parseLearningEvent, type LearningEvent } from '@/features/course-pack/attempts';

export async function appendPractice(userId: string, incoming: LearningEvent[]) {
  const events = mergeLearningEvents(incoming);
  await prisma.$transaction(async tx => {
    // Serialize this account's event writes before assigning server sequence numbers.
    // This prevents a later page cursor from overtaking an uncommitted earlier write.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const existing = await tx.foundationPracticeEvent.findMany({
      where: { userId, eventId: { in: events.map(e => e.id) } },
    });
    mergeLearningEvents(existing.map(row => parseLearningEvent(row.payload)), events);
    const known = new Set(existing.map(row => row.eventId));
    await tx.foundationPracticeEvent.createMany({
      data: events.filter(e => !known.has(e.id)).map(e => ({ userId, eventId: e.id, payload: e })),
    });
  });
}

export async function pullPractice(userId: string, after: bigint) {
  const rows = await prisma.foundationPracticeEvent.findMany({
    where: { userId, sequence: { gt: after } }, orderBy: { sequence: 'asc' }, take: 500,
  });
  return {
    events: rows.map(row => parseLearningEvent(row.payload)),
    nextCursor: rows.length === 500 ? rows[rows.length - 1].sequence.toString() : null,
  };
}
