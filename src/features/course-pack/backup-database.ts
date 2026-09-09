import { mergeEvents, type PracticeEvent } from './progress';
import { mergeLearningEvents, type LearningEvent } from './attempts';

/** Both generations commit together, or neither does. Checkpoints stay local. */
export async function importBackupDatabase(open: () => Promise<IDBDatabase>, incoming: {
  events: PracticeEvent[]; lessonEvents: LearningEvent[];
}): Promise<void> {
  const legacy = mergeEvents(incoming.events);
  const lessons = mergeLearningEvents(incoming.lessonEvents);
  mergeLearningEvents(legacy, lessons);
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['events', 'lesson-events'], 'readwrite');
      const oldStore = tx.objectStore('events'), lessonStore = tx.objectStore('lesson-events');
      const oldRead = oldStore.getAll(), lessonRead = lessonStore.getAll();
      let ready = 0;
      let conflict: unknown;
      const apply = () => {
        if (++ready !== 2) return;
        try {
          mergeEvents(oldRead.result, legacy);
          mergeLearningEvents(lessonRead.result, lessons);
          mergeLearningEvents(oldRead.result, lessonRead.result, legacy, lessons);
          for (const event of legacy) oldStore.put(event);
          for (const event of lessons) lessonStore.put(event);
        } catch (error) { conflict = error; tx.abort(); }
      };
      oldRead.onsuccess = apply;
      lessonRead.onsuccess = apply;
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(conflict ?? tx.error ?? new Error('Backup was not imported. Existing practice is unchanged.'));
      tx.onerror = () => {};
    });
  } finally { db.close(); }
}
