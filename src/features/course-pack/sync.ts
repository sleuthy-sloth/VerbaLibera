import { z } from 'zod';
import { csrfHeaders } from '../../lib/auth/cookies';
import { mergeEvents, type PracticeEvent } from './progress';
import { learningEventSchema, mergeLearningEvents, type LearningEvent } from './attempts';
import { readEvents, storeEvents, readLessonEvents, storeLessonEvents } from './storage';
const pageSchema = z.object({ userId: z.string(), events: z.array(learningEventSchema).max(500), lessonEvents: z.array(learningEventSchema).max(500).default([]), nextCursor: z.string().regex(/^\d{1,18}$/).nullable() });
async function responseJson(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Synchronization failed. Local practice is safe.');
  return body;
}
export async function identifyAccount(): Promise<string> {
  const body = await responseJson(await fetch('/api/course-progress', { cache: 'no-store', credentials: 'same-origin' }));
  return z.string().min(1).max(100).parse(body.userId);
}
async function postBatch(userId: string, events: PracticeEvent[] | LearningEvent[], signal?: AbortSignal) {
  for (let offset = 0; offset < events.length; offset += 100) {
    const body = await responseJson(await fetch('/api/course-progress', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ userId, events: events.slice(offset, offset + 100) }),
    }));
    if (body.userId !== userId || body.saved !== true) throw new Error('Account synchronization was not acknowledged. Local practice is safe.');
  }
}
export async function synchronizePractice(userId: string, signal?: AbortSignal) {
  let after = '0';
  const remote: PracticeEvent[] = [];
  const remoteLessons: LearningEvent[] = [];
  do {
    const response = await fetch(`/api/course-progress?userId=${encodeURIComponent(userId)}&after=${after}`, { cache: 'no-store', credentials: 'same-origin', signal });
    const page = pageSchema.parse(await responseJson(response));
    if (page.userId !== userId) throw new Error('The signed-in account changed. Local practice was not uploaded.');
    if (page.nextCursor && BigInt(page.nextCursor) <= BigInt(after)) throw new Error('Invalid synchronization cursor. Retry later.');
    // The server paginates one ordered stream containing both event versions.
    // Parse the entire page before any write; never strip a v2 row into v1.
    const allEvents = mergeLearningEvents(page.events, page.lessonEvents);
    const legacy = allEvents.filter((event): event is PracticeEvent => !('eventVersion' in event));
    const lessonEvents = allEvents.filter(event => 'eventVersion' in event);
    await storeEvents(legacy, userId);
    await storeLessonEvents(lessonEvents, userId);
    remote.push(...legacy);
    remoteLessons.push(...lessonEvents);
    if (!page.nextCursor) break;
    after = page.nextCursor;
  } while (!signal?.aborted);
  if (signal?.aborted) throw new Error('Synchronization interrupted. Local practice is safe.');
  const local = await readEvents(userId);
  mergeEvents(remote, local); // Reject conflicting IDs instead of silently overwriting either copy.
  const lessons = await readLessonEvents(userId);
  mergeLearningEvents(remoteLessons, lessons);
  const known = new Set(remote.map(e => e.id));
  // V1 rows upload first so an old server never sees a batch it must reject.
  await postBatch(userId, local.filter(e => !known.has(e.id)), signal);
  const knownLessons = new Set(remoteLessons.map(e => e.id));
  await postBatch(userId, lessons.filter(e => !knownLessons.has(e.id)), signal);
  return readEvents(userId);
}
