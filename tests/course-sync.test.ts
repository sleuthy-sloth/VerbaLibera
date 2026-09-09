import { beforeEach, expect, it, vi } from 'vitest';
const local = vi.hoisted(() => ({ read: vi.fn(), store: vi.fn(), readLessons: vi.fn(), storeLessons: vi.fn() }));
vi.mock('@/features/course-pack/storage', () => ({ readEvents: local.read, storeEvents: local.store, readLessonEvents: local.readLessons, storeLessonEvents: local.storeLessons }));
import { synchronizePractice } from '@/features/course-pack/sync';
const event = { id: 'remote', packId: 'it-foundations', version: '1.0.0', exerciseId: 'one', at: '2026-09-05T10:00:00.000Z', correct: true, revealed: false };
const pending = { ...event, id: 'pending' };
const fetchMock = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', fetchMock); local.read.mockResolvedValue([event, pending]); local.store.mockResolvedValue(undefined); local.readLessons.mockResolvedValue([]); local.storeLessons.mockResolvedValue(undefined); });
it('persists downloaded events before uploading only missing local events', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [event], nextCursor: null })).mockResolvedValueOnce(Response.json({ userId: 'a', saved: true }));
  await synchronizePractice('a');
  expect(local.store).toHaveBeenCalledWith([event], 'a');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ userId: 'a', events: [pending] });
  expect(local.store.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]);
});
it('does not upload under a changed account', async () => {
  fetchMock.mockResolvedValue(Response.json({ userId: 'b', events: [], nextCursor: null }));
  await expect(synchronizePractice('a')).rejects.toThrow(/account/i);
  expect(local.store).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('never acknowledges a download that failed local persistence', async () => {
  fetchMock.mockResolvedValue(Response.json({ userId: 'a', events: [event], nextCursor: null }));
  local.store.mockRejectedValue(new Error('Quota exceeded'));
  await expect(synchronizePractice('a')).rejects.toThrow('Quota');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('retries an interrupted upload with identical mutation IDs', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [], nextCursor: null })).mockRejectedValueOnce(new Error('Offline'));
  await expect(synchronizePractice('a')).rejects.toThrow('Offline');
  const sent = fetchMock.mock.calls[1][1].body;
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [], nextCursor: null })).mockResolvedValueOnce(Response.json({ userId: 'a', saved: true }));
  await synchronizePractice('a');
  expect(fetchMock.mock.calls[3][1].body).toBe(sent);
});
it('walks every page and does not duplicate already synchronized events', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [event], nextCursor: '500' })).mockResolvedValueOnce(Response.json({ userId: 'a', events: [pending], nextCursor: null }));
  await synchronizePractice('a');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toContain('after=500');
});

const lessonAttempt = {
  eventVersion: 2, type: 'attempt', id: 'lesson-remote', packId: 'it-foundations',
  packVersion: '1.0.0', lessonId: 'it-cafe-story', lessonRevision: 1,
  stepId: 'story-answer', activityId: 'story-choice', activityRevision: 1,
  evidenceKey: 'story-evidence', response: { kind: 'selection', ids: ['coffee'] },
  assistance: [], evaluation: { outcome: 'correct', independent: true, feedback: 'Correct.' },
  at: event.at,
};
it('routes the server mixed event stream into its corresponding local stores', async () => {
  local.read.mockResolvedValue([event]);
  local.readLessons.mockResolvedValue([lessonAttempt]);
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [event, lessonAttempt], nextCursor: null }));
  await synchronizePractice('a');
  expect(local.store).toHaveBeenCalledWith([event], 'a');
  expect(local.storeLessons).toHaveBeenCalledWith([lessonAttempt], 'a');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('rejects unsupported versioned events before persisting either part of the page', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [event, { ...event, eventVersion: 3 }], nextCursor: null }));
  await expect(synchronizePractice('a')).rejects.toThrow();
  expect(local.store).not.toHaveBeenCalled();
  expect(local.storeLessons).not.toHaveBeenCalled();
});
it('does not upload an empty event batch after a mixed remote page', async () => {
  local.read.mockResolvedValue([]);
  local.readLessons.mockResolvedValue([lessonAttempt]);
  fetchMock.mockResolvedValueOnce(Response.json({ userId: 'a', events: [lessonAttempt], nextCursor: '500' }))
    .mockResolvedValueOnce(Response.json({ userId: 'a', events: [], nextCursor: null }));
  await synchronizePractice('a');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toContain('after=500');
});
