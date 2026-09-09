import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createHostedEnvironment } from '@/features/course-pack/hosted-environment';
import type { LessonCheckpoint } from '@/features/course-pack/attempts';
const checkpoint: LessonCheckpoint = {
  packId: 'it-foundations', lessonId: 'it-story', revision: 1, stepId: 'story-start',
  selectedBranches: {}, assistance: ['translation'], draft: {kind: 'text', text: 'Un caffè'},
  at: '2026-09-08T10:00:00.000Z',
};
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
it('provides a durable lesson store bound to the selected account', async () => {
  const a = createHostedEnvironment('account-a');
  const b = createHostedEnvironment('account-b');
  expect(a.lessonPractice).toBeDefined();
  await a.lessonPractice!.writeCheckpoint(checkpoint);
  expect(await a.lessonPractice!.readCheckpoint(checkpoint.packId, checkpoint.lessonId)).toEqual(checkpoint);
  expect(await b.lessonPractice!.readCheckpoint(checkpoint.packId, checkpoint.lessonId)).toBeNull();
  expect(await createHostedEnvironment().lessonPractice!.readCheckpoint(checkpoint.packId, checkpoint.lessonId)).toBeNull();
});
it('keeps a captured store bound to its original account after switching', async () => {
  const oldStore = createHostedEnvironment('account-a').lessonPractice!;
  const currentStore = createHostedEnvironment('account-b').lessonPractice!;
  await oldStore.writeCheckpoint(checkpoint);
  expect(await currentStore.readCheckpoint(checkpoint.packId, checkpoint.lessonId)).toBeNull();
});
