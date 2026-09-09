import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { createMemoryLessonPractice } from '@/features/course-pack/environment';
import { probeLessonPractice } from '@/features/course-pack/portable-environment';
import type { LearningEvent, LessonCheckpoint } from '@/features/course-pack/attempts';
const event = (id = 'a'): LearningEvent => ({ id, packId: 'pack', version: '1.0.0', exerciseId: 'ex', at: '2026-09-08T10:00:00.000Z', correct: true, revealed: false });
const checkpoint = (): LessonCheckpoint => ({ packId: 'pack', lessonId: 'lesson', revision: 1, stepId: 'step', selectedBranches: {}, assistance: [], draft: {kind: 'text', text: 'hello'}, at: '2026-09-08T10:00:00.000Z' });
describe('lesson store recovery', () => {
  afterEach(() => vi.restoreAllMocks());
  it('memory retries are idempotent and conflicting retries reject', async () => {
    const store = createMemoryLessonPractice([event()]);
    await store.writeLessons([event()]);
    expect(await store.readLessons()).toHaveLength(1);
    await expect(store.writeLessons([{...event(), correct: false} as LearningEvent])).rejects.toThrow();
    expect(await store.readLessons()).toEqual([event()]);
  });
  it('memory snapshots cannot be mutated through caller references', async () => {
    const input = event();
    const store = createMemoryLessonPractice([input]);
    input.id = 'changed';
    const read = await store.readLessons();
    read[0].id = 'changed again';
    expect(await store.readLessons()).toEqual([event()]);
    const cp = checkpoint();
    await store.writeCheckpoint(cp);
    cp.assistance.push('model');
    const saved = await store.readCheckpoint('pack', 'lesson');
    saved!.assistance.push('hint');
    expect(await store.readCheckpoint('pack', 'lesson')).toEqual(checkpoint());
  });
  it('durable conflicts never downgrade into an empty memory store', async () => {
    const store = await probeLessonPractice({indexedDB: new IDBFactory()});
    await store.writeLessons([event()]);
    const conflict = {...event(), correct: false} as LearningEvent;
    await expect(store.writeLessons([conflict])).rejects.toThrow();
    await expect(store.writeLessons([conflict])).rejects.toThrow();
    expect(await store.readLessons()).toEqual([event()]);
  });
  it('transient reads reject and recover without forgetting durable history', async () => {
    const factory = new IDBFactory();
    const store = await probeLessonPractice({indexedDB: factory});
    await store.writeLessons([event()]);
    const spy = vi.spyOn(factory, 'open').mockImplementationOnce(() => { throw new Error('temporary failure'); });
    await expect(store.readLessons()).rejects.toThrow('temporary failure');
    spy.mockRestore();
    expect(await store.readLessons()).toEqual([event()]);
  });
  it('failed writes remain unsaved and recover against durable history', async () => {
    const factory = new IDBFactory();
    const store = await probeLessonPractice({indexedDB: factory});
    await store.writeLessons([event()]);
    vi.spyOn(factory, 'open').mockImplementationOnce(() => { throw new Error('write unavailable'); });
    await expect(store.writeLessons([event('b')])).rejects.toThrow('write unavailable');
    expect(await store.readLessons()).toEqual([event()]);
    await store.writeLessons([event('b')]);
    expect(await store.readLessons()).toEqual([event(), event('b')]);
  });
  it('failed checkpoint transactions close their connection and preserve the prior checkpoint', async () => {
    const factory = new IDBFactory();
    const store = await probeLessonPractice({indexedDB: factory});
    await store.writeCheckpoint(checkpoint());
    const close = vi.spyOn(IDBDatabase.prototype, 'close');
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementationOnce(() => { throw new Error('transaction unavailable'); });
    await expect(store.writeCheckpoint({...checkpoint(), stepId: 'later'})).rejects.toThrow('transaction unavailable');
    expect(close).toHaveBeenCalledTimes(1);
    expect(await store.readCheckpoint('pack', 'lesson')).toEqual(checkpoint());
  });
  it('checkpoint writes close the database connection', async () => {
    const store = await probeLessonPractice({indexedDB: new IDBFactory()});
    const close = vi.spyOn(IDBDatabase.prototype, 'close');
    await store.writeCheckpoint(checkpoint());
    expect(close).toHaveBeenCalledTimes(1);
    close.mockRestore();
  });
});
