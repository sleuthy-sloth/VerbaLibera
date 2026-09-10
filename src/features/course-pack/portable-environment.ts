import { importBackupDatabase } from "./backup-database";
  import { decodeBackupEnvelope, encodeBackup } from "./storage";
import type {
  CourseEnvironment,
  LessonPracticeStore,
  PracticeDurability,
  PracticeStore,
} from "./environment";
import { createMemoryLessonPractice } from "./environment";
import {
  lessonCheckpointSchema,
  mergeLearningEvents,
  type LearningEvent,
  type LessonCheckpoint,
} from "./attempts";
import { mergeEvents, type PracticeEvent } from "./progress";
import { normalizePack } from "./normalize-pack";
import { validatePack } from "./schema";
import type { PortableContent } from "../../../scripts/portable/content";

const DATABASE_NAME = "verbalibera-portable-practice";
const DATABASE_VERSION = 2;

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("events")) {
        request.result.createObjectStore("events", { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains("probe")) {
        request.result.createObjectStore("probe");
      }
      // Version 2 adds v2 lesson events and checkpoints; v1 rows untouched.
      if (!request.result.objectStoreNames.contains("lesson-events")) {
        request.result.createObjectStore("lesson-events", { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains("checkpoints")) {
        request.result.createObjectStore("checkpoints", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
  });
}

async function provePersistence(factory: IDBFactory): Promise<void> {
  const db = await openDatabase(factory);
  await new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction("probe", "readwrite");
      const store = transaction.objectStore("probe");
      store.put("ready", "portable-storage-probe");
      const read = store.get("portable-storage-probe");
      read.onsuccess = () => {
        if (read.result !== "ready") transaction.abort();
        else store.delete("portable-storage-probe");
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB probe failed."));
      transaction.onerror = () => {};
    } catch (error) {
      reject(error);
    }
  }).finally(() => db.close());
}

async function readDurable(factory: IDBFactory): Promise<PracticeEvent[]> {
  const db = await openDatabase(factory);
  return new Promise<PracticeEvent[]>((resolve, reject) => {
    try {
      const transaction = db.transaction("events", "readonly");
      const request = transaction.objectStore("events").getAll();
      transaction.oncomplete = () => {
        try {
          resolve(mergeEvents(request.result));
        } catch (error) {
          reject(error);
        }
      };
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not read portable practice."));
    } catch (error) {
      reject(error);
    }
  }).finally(() => db.close());
}

async function writeDurable(
  factory: IDBFactory,
  events: PracticeEvent[],
): Promise<void> {
  const db = await openDatabase(factory);
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction("events", "readwrite");
      const store = transaction.objectStore("events");
      for (const event of events) store.put(event);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("Portable practice write aborted."));
      transaction.onerror = () => {};
    } catch (error) {
      reject(error);
    }
  }).finally(() => db.close());
}

function temporaryStore(initial: PracticeEvent[] = []): PracticeStore {
  let events = mergeEvents(initial);
  return {
    getDurability: () => "temporary",
    subscribeDurability: () => () => {},
    read: async () => events,
    write: async (incoming) => {
      events = mergeEvents(events, incoming);
    },
  };
}

function durableStore(factory: IDBFactory): PracticeStore {
  let durability: PracticeDurability = "durable";
  let memory: PracticeEvent[] = [];
  const listeners = new Set<(value: PracticeDurability) => void>();

  const fallBack = (events: PracticeEvent[]) => {
    memory = mergeEvents(events);
    durability = "temporary";
    for (const listener of listeners) listener(durability);
  };

  return {
    getDurability: () => durability,
    subscribeDurability(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: async () =>
      durability === "durable" ? readDurable(factory) : memory,
    async write(incoming) {
      const validated = mergeEvents(incoming);
      if (durability === "temporary") {
        memory = mergeEvents(memory, validated);
        return;
      }
      const existing = await readDurable(factory);
      mergeEvents(existing, validated);
      try {
        await writeDurable(factory, validated);
      } catch {
        fallBack(existing);
        throw new Error(
          "Storage is unavailable. This practice was not saved; export a backup before closing.",
        );
      }
    },
  };
}

const TYPE_HINT_MAP: Record<string, string> = {
  cloze: 'missing word',
  order: 'drag into order',
  meaning: 'choose the meaning',
  speaking: 'speak the phrase',
  listening: 'listen and type',
  notice: 'notice pattern',
  reading: 'reading',
};

export function hintNextExerciseType(lesson: {
  start: number;
  length: number;
  steps: { exercise?: { type?: string } }[];
  getNextStepIndex: (step: number) => number;
}, step: number): string {
  return lesson.steps[step]?.exercise?.type ?? 'reading';
}

export function resolveNextStepForType(lesson: {
  start: number;
  length: number;
  steps: { exercise?: { type?: string } }[];
  getNextStepIndex: (step: number) => number;
}, currentStep: number, exerciseType: string): number {
  for (let i = currentStep; i < lesson.start + lesson.length; i++) {
    if (hintNextExerciseType(lesson, i) === exerciseType) return i;
  }
  return lesson.start + lesson.length - 1;
}

export async function probePortableStore(options: {
  indexedDB?: IDBFactory;
}): Promise<PracticeStore> {
  if (!options.indexedDB) return temporaryStore();
  try {
    await provePersistence(options.indexedDB);
    return durableStore(options.indexedDB);
  } catch {
    return temporaryStore();
  }
}

async function readLessonDurable(factory: IDBFactory): Promise<LearningEvent[]> {
  const db = await openDatabase(factory);
  return new Promise<LearningEvent[]>((resolve, reject) => {
    try {
      const transaction = db.transaction("lesson-events", "readonly");
      const request = transaction.objectStore("lesson-events").getAll();
      transaction.oncomplete = () => {
        try {
          resolve(mergeLearningEvents(request.result));
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not read portable lesson practice."));
      transaction.onerror = () => {};
    } catch (error) {
      reject(error);
    }
  }).finally(() => db.close());
}

async function writeLessonDurable(
  factory: IDBFactory,
  events: LearningEvent[],
): Promise<void> {
  const validated = mergeLearningEvents(events);
  const db = await openDatabase(factory);
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction("lesson-events", "readwrite");
      const store = transaction.objectStore("lesson-events");
      const read = store.getAll();
      let conflict: unknown;
      read.onsuccess = () => {
        try {
          mergeLearningEvents(read.result, validated);
          for (const event of validated) store.put(event);
        } catch (e) {
          conflict = e;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(conflict ?? transaction.error ?? new Error("Portable lesson write aborted."));
      transaction.onerror = () => {};
    } catch (error) {
      reject(error);
    }
  }).finally(() => db.close());
}

function durableLessonStore(factory: IDBFactory): LessonPracticeStore {
  // Once persistence is established, errors must remain visible to callers.
  // Switching to memory here would hide saved history and accept failed retries.
  return {
    readLessons: () => readLessonDurable(factory),
    writeLessons: (incoming) => writeLessonDurable(factory, incoming),
    async readCheckpoint(packId, lessonId) {
      const db = await openDatabase(factory);
      try {
        return await new Promise<LessonCheckpoint | null>((resolve, reject) => {
          const transaction = db.transaction("checkpoints", "readonly");
          const request = transaction.objectStore("checkpoints").get(`${packId}/${lessonId}`);
          transaction.oncomplete = () => {
            try {
              const row = request.result as (LessonCheckpoint & { key: string }) | undefined;
              if (!row) return resolve(null);
              resolve(lessonCheckpointSchema.parse(row));
            } catch (e) {
              reject(e);
            }
          };
          transaction.onabort = () => reject(transaction.error ?? new Error("Could not read portable checkpoint."));
          transaction.onerror = () => {};
        });
      } finally {
        db.close();
      }
    },
    async writeCheckpoint(checkpoint) {
      const parsed = lessonCheckpointSchema.parse(checkpoint);
      const db = await openDatabase(factory);
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction("checkpoints", "readwrite");
          transaction.objectStore("checkpoints").put({ ...parsed, key: `${parsed.packId}/${parsed.lessonId}` });
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error ?? new Error("Portable checkpoint was not saved."));
          transaction.onerror = () => {};
        });
      } finally {
        db.close();
      }
    },
  };
}

export async function probeLessonPractice(options: {
  indexedDB?: IDBFactory;
}): Promise<LessonPracticeStore> {
  if (!options.indexedDB) return createMemoryLessonPractice();
  try {
    await provePersistence(options.indexedDB);
    return durableLessonStore(options.indexedDB);
  } catch {
    return createMemoryLessonPractice();
  }
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function createPortableEnvironment(
  content: PortableContent,
  options: { indexedDB?: IDBFactory } = {
    indexedDB: globalThis.indexedDB,
  },
): Promise<CourseEnvironment> {
  const practice = await probePortableStore(options);
  const initiallyDurable = practice.getDurability() === "durable" && !!options.indexedDB;
  const lessonPractice = initiallyDurable
    ? durableLessonStore(options.indexedDB!) : createMemoryLessonPractice();
  const mediaUrls = new Map(
    Object.entries(content.assets).map(([path, asset]) => [
      path,
      URL.createObjectURL(
        new Blob([decodeBase64(asset.base64)], { type: asset.mime }),
      ),
    ]),
  );

  return {
    capabilities: {
      accounts: false,
      synchronization: false,
      offlineInstall: false,
      hostedNavigation: false,
    },
    practice,
    lessonPractice,
    backup: {
      async export() { return encodeBackup(await practice.read(), await lessonPractice.readLessons()); },
      async import(raw) {
        const incoming = decodeBackupEnvelope(raw);
        if (initiallyDurable) {
          if (practice.getDurability() !== "durable")
            throw new Error("Storage became unavailable. Export your practice, then reopen before importing.");
          await importBackupDatabase(() => openDatabase(options.indexedDB!), incoming);
        } else {
          // Both stores are memory-only here. Validate the whole merge before
          // either synchronous memory mutation, preserving atomic conflicts.
          const legacy = await practice.read(), lessons = await lessonPractice.readLessons();
          mergeLearningEvents(legacy, lessons, incoming.events, incoming.lessonEvents);
          const nextLegacy = mergeEvents(legacy, incoming.events);
          const nextLessons = mergeLearningEvents(lessons, incoming.lessonEvents);
          await practice.write(nextLegacy);
          await lessonPractice.writeLessons(nextLessons);
        }
      },
    },
    async loadCourse(language) {
      const raw = structuredClone(content.packs[language]);
      if (!raw) throw new Error(`Course is not embedded: ${language}`);
      return (raw as {schemaVersion: number}).schemaVersion === 2 ? normalizePack(raw) : validatePack(raw);
    },
    async loadPack(language) {
      const pack = content.packs[language];
      if (!pack) throw new Error(`Course is not embedded: ${language}`);
      return validatePack(structuredClone(pack));
    },
    resolveMedia(path) {
      const url = mediaUrls.get(path);
      if (!url) throw new Error(`Missing embedded asset: ${path}`);
      return url;
    },
  };
}
