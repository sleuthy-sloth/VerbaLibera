import { z } from "zod";
import { importBackupDatabase } from "./backup-database";
import { mergeEvents, type PracticeEvent } from "./progress";
import {
  learningEventSchema,
  lessonCheckpointSchema,
  mergeLearningEvents,
  type LearningEvent,
  type LessonCheckpoint,
} from "./attempts";
import type { CoursePack } from "./schema";
const DB = "verbalibera-course-practice";
const DB_VERSION = 2;
const legacyBackupEventSchema = learningEventSchema.transform((event, ctx): PracticeEvent => {
  if ("eventVersion" in event) {
    ctx.addIssue({ code: "custom", message: "Versioned lesson events belong in the lessonEvents backup array." });
    return z.NEVER;
  }
  return event;
});
export function decodeBackup(raw: string): PracticeEvent[] {
  if (raw.length > 10_000_000) throw new Error("Backup is too large.");
  const parsed = z
    .object({ format: z.literal(1), events: z.array(legacyBackupEventSchema).max(25000) })
    .parse(JSON.parse(raw));
  return mergeEvents(parsed.events);
}
const backupEnvelopeSchema = z.discriminatedUnion("format", [
  z.object({ format: z.literal(1), events: z.array(legacyBackupEventSchema).max(25000) }),
  z.object({
    format: z.literal(2),
    events: z.array(legacyBackupEventSchema).max(25000),
    lessonEvents: z.array(learningEventSchema).max(25000),
  }),
]);
export type BackupEnvelope =
  | { format: 1; events: PracticeEvent[]; lessonEvents: [] }
  | { format: 2; events: PracticeEvent[]; lessonEvents: LearningEvent[] };
/**
 * Format-two envelopes carry v2 lesson events alongside v1 rows. Format-one
 * imports never invent completion events (lessonEvents is empty). Draft
 * checkpoints are local-only and never enter a backup.
 */
export function decodeBackupEnvelope(raw: string): BackupEnvelope {
  if (raw.length > 10_000_000) throw new Error("Backup is too large.");
  const parsed = backupEnvelopeSchema.parse(JSON.parse(raw));
  if (parsed.format === 1)
    return { format: 1, events: mergeEvents(parsed.events), lessonEvents: [] };
  return {
    format: 2,
    events: mergeEvents(parsed.events),
    lessonEvents: mergeLearningEvents(parsed.lessonEvents),
  };
}
export function encodeBackup(
  events: PracticeEvent[],
  lessonEvents: LearningEvent[],
): { format: 1 | 2; events: PracticeEvent[]; lessonEvents?: LearningEvent[] } {
  if (!lessonEvents.length) return { format: 1, events: mergeEvents(events) };
  return {
    format: 2,
    events: mergeEvents(events),
    lessonEvents: mergeLearningEvents(lessonEvents),
  };
}
async function database(userId?: string | null): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(userId ? `${DB}-account-${encodeURIComponent(userId)}` : DB, DB_VERSION);
    request.onupgradeneeded = () => {
      // Version 2 adds lesson-events and checkpoints; the v1 events store
      // is never altered, so old rows keep their conflict identity.
      const db = request.result;
      if (!db.objectStoreNames.contains("events"))
        db.createObjectStore("events", { keyPath: "id" });
      if (!db.objectStoreNames.contains("lesson-events"))
        db.createObjectStore("lesson-events", { keyPath: "id" });
      if (!db.objectStoreNames.contains("checkpoints"))
        db.createObjectStore("checkpoints", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Device storage could not be opened. Practice has not been saved.",
        ),
      );
  });
}
export async function readEvents(userId?: string | null): Promise<PracticeEvent[]> {
  const db = await database(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const request = tx.objectStore("events").getAll();
    tx.oncomplete = () => {
      db.close();
      try {
        resolve(mergeEvents(request.result));
      } catch (e) {
        reject(e);
      }
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not read device practice."));
    };
  });
}
export async function storeEvents(incoming: PracticeEvent[], userId?: string | null): Promise<void> {
  const validated = mergeEvents(incoming),
    db = await database(userId);
  return new Promise((resolve, reject) => {
    // Read and write in one serialized transaction; concurrent tabs cannot lose practice.
    const tx = db.transaction("events", "readwrite"),
      store = tx.objectStore("events"),
      read = store.getAll();
    let conflict: unknown;
    read.onsuccess = () => {
      try {
        mergeEvents(read.result, validated);
        for (const event of validated) store.put(event);
      } catch (e) {
        conflict = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(
        conflict ??
          new Error(
            "Storage is full or unavailable. Practice was not saved. Export your existing progress.",
          ),
      );
    };
    tx.onerror = () => {};
  });
}
export async function readLessonEvents(userId?: string | null): Promise<LearningEvent[]> {
  const db = await database(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("lesson-events", "readonly");
    const request = tx.objectStore("lesson-events").getAll();
    tx.oncomplete = () => {
      db.close();
      try {
        resolve(mergeLearningEvents(request.result));
      } catch (e) {
        reject(e);
      }
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not read device lesson practice."));
    };
  });
}
export async function storeLessonEvents(incoming: LearningEvent[], userId?: string | null): Promise<void> {
  const validated = mergeLearningEvents(incoming),
    db = await database(userId);
  return new Promise((resolve, reject) => {
    // Attempts and their step completion commit atomically: a graded step
    // completion without its matching attempt rejects the whole batch.
    const tx = db.transaction("lesson-events", "readwrite"),
      store = tx.objectStore("lesson-events"),
      read = store.getAll();
    let conflict: unknown;
    read.onsuccess = () => {
      try {
        mergeLearningEvents(read.result, validated);
        for (const event of validated) store.put(event);
      } catch (e) {
        conflict = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(
        conflict ??
          new Error(
            "Storage is full or unavailable. Practice was not saved. Export your existing progress.",
          ),
      );
    };
    tx.onerror = () => {};
  });
}
const checkpointKey = (packId: string, lessonId: string) => `${packId}/${lessonId}`;
/**
 * Unfinished drafts live in a local-only store scoped per account, pack,
 * lesson, and revision. They never enter backups or sync payloads.
 */
export async function writeCheckpoint(checkpoint: LessonCheckpoint, userId?: string | null): Promise<void> {
  const parsed = lessonCheckpointSchema.parse(checkpoint);
  const db = await database(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readwrite");
    tx.objectStore("checkpoints").put({ ...parsed, key: checkpointKey(parsed.packId, parsed.lessonId) });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(new Error("The draft checkpoint was not saved."));
    };
    tx.onerror = () => {};
  });
}
export async function readCheckpoint(
  userId: string | null | undefined,
  packId: string,
  lessonId: string,
): Promise<LessonCheckpoint | null> {
  const db = await database(userId);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("checkpoints", "readonly");
    const request = tx.objectStore("checkpoints").get(checkpointKey(packId, lessonId));
    tx.oncomplete = () => {
      db.close();
      try {
        const row = request.result as (LessonCheckpoint & { key: string }) | undefined;
        if (!row) return resolve(null);
        // The storage key is not part of the checkpoint; parse strips it.
        resolve(lessonCheckpointSchema.parse(row));
      } catch (e) {
        reject(e);
      }
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not read the draft checkpoint."));
    }
  });
}
export async function installPack(
  pack: CoursePack,
  language: string,
): Promise<void> {
  if (!("serviceWorker" in navigator) || !("caches" in window))
    throw new Error(
      "Offline installation needs a secure browser with service worker support.",
    );
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  // Capture only already-committed installations. Never delete another tab's
  // in-progress download, including one started while our network requests run.
  const previous: string[] = [];
  for (const key of await caches.keys()) {
    if (!key.startsWith(`verbalibera-pack-${pack.id}-`)) continue;
    const old = await caches.open(key);
    if (await old.match("/__course_pack_ready__")) previous.push(key);
  }
  const name = `verbalibera-pack-${pack.id}-${pack.version}-${crypto.randomUUID()}`;
  const cache = await caches.open(name);
  try {
    for (const url of [
      "/study.html",
      "/study.js",
      "/study.css",
      `/packs/${language}.json`,
      ...pack.media.map((m) => m.url),
    ]) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok)
        throw new Error(`Download failed: ${url}. Retry when connected.`);
      const media = pack.media.find((m) => m.url === url);
      if (media) {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await response.clone().arrayBuffer(),
        );
        const hash = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== media.sha256)
          throw new Error(
            "Audio integrity check failed. Download was not installed.",
          );
      }
      if (url.endsWith(".json")) {
        const received = await response.clone().json();
        if (received.version !== pack.version || received.id !== pack.id)
          throw new Error(
            "The course changed during download. Reload and retry.",
          );
      }
      await cache.put(url, response);
    }
    // Only caches with this final commit marker are read by the service worker.
    await cache.put("/__course_pack_ready__", new Response(pack.version));
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
  // Replace this language only, after the new installation is complete.
  for (const key of previous) await caches.delete(key);
  await navigator.storage?.persist?.().catch(() => false);
}
export async function installedPack(language: string): Promise<boolean> {
  if (!("caches" in globalThis)) return false;
  for (const key of await caches.keys())
    if (key.startsWith("verbalibera-pack-")) {
      const c = await caches.open(key);
      if (
        (await c.match("/__course_pack_ready__")) &&
        (await c.match(`/packs/${language}.json`))
      )
        return true;
    }
  return false;
}

export async function importPracticeBackup(raw: string, scope?: string | null): Promise<void> {
  const incoming = decodeBackupEnvelope(raw);
  await importBackupDatabase(() => database(scope), incoming);
}
