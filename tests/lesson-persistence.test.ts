import { beforeEach, describe, expect, it, vi } from "vitest";
import { indexedDB } from "fake-indexeddb";
import {
  decodeBackupEnvelope,
  encodeBackup,
  readCheckpoint,
  readCheckpoints,
  readEvents,
  readLessonEvents,
  storeLessonEvents,
  writeCheckpoint,
} from "@/features/course-pack/storage";
import { probeLessonPractice } from "@/features/course-pack/portable-environment";
import type { LessonCheckpoint } from "@/features/course-pack/attempts";

const AT = "2026-09-08T10:00:00.000Z";
const v1event = (id: string) => ({
  id,
  packId: "it-variety-pilot",
  version: "0.1.0",
  exerciseId: "lg-ex-meet",
  at: AT,
  correct: true,
  revealed: false,
});
const attempt = (id: string) => ({
  eventVersion: 2 as const,
  type: "attempt" as const,
  id,
  packId: "it-variety-pilot",
  packVersion: "0.1.0",
  lessonId: "it-cafe-story",
  lessonRevision: 1,
  stepId: "st-s2",
  activityId: "act-story-evidence",
  activityRevision: 1,
  evidenceKey: "ev-story-evidence",
  response: { kind: "selection" as const, ids: ["un-caffe"] },
  assistance: [],
  evaluation: { outcome: "correct" as const, independent: true, feedback: "Good." },
  at: AT,
});
const checkpoint = (over: Partial<LessonCheckpoint> = {}): LessonCheckpoint => ({
  packId: "it-variety-pilot",
  lessonId: "it-cafe-story",
  revision: 1,
  stepId: "st-s2",
  selectedBranches: {},
  assistance: [],
  draft: null,
  at: AT,
  ...over,
});

const deleteDatabase = (name: string) =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("lesson backup envelopes", () => {
  it("imports format one without inventing completion events", () => {
    const decoded = decodeBackupEnvelope(
      JSON.stringify({ format: 1, events: [v1event("a")] }),
    );
    expect(decoded).toEqual({ format: 1, events: [v1event("a")], lessonEvents: [] });
  });

  it("round-trips format two with mixed events", () => {
    const encoded = encodeBackup([v1event("a")], [attempt("att-1")]);
    expect(encoded.format).toBe(2);
    const decoded = decodeBackupEnvelope(JSON.stringify(encoded));
    expect(decoded.format).toBe(2);
    if (decoded.format === 2) {
      expect(decoded.events).toEqual([v1event("a")]);
      expect(decoded.lessonEvents).toEqual([attempt("att-1")]);
    }
  });

  it("exports format one when no lesson events exist", () => {
    expect(encodeBackup([v1event("a")], []).format).toBe(1);
  });

  it("rejects format two without lesson events", () => {
    expect(() =>
      decodeBackupEnvelope(JSON.stringify({ format: 2, events: [] })),
    ).toThrow();
  });
});

describe("lesson event storage", () => {
  beforeEach(async () => {
    await deleteDatabase("verbalibera-course-practice");
    vi.stubGlobal("indexedDB", indexedDB);
  });

  it("upgrades a v1 database preserving old rows", async () => {
    // Seed a version-1 database the way the old code created it.
    const seed = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verbalibera-course-practice", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("events", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = seed.transaction("events", "readwrite");
      tx.objectStore("events").put(v1event("old-row"));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    seed.close();
    expect(await readEvents()).toEqual([v1event("old-row")]);
    expect(await readLessonEvents()).toEqual([]);
  });

  it("stores attempts idempotently and rejects conflicts atomically", async () => {
    await storeLessonEvents([attempt("att-1")]);
    await storeLessonEvents([attempt("att-1")]);
    expect(await readLessonEvents()).toEqual([attempt("att-1")]);
    await expect(
      storeLessonEvents([{ ...attempt("att-1"), stepId: "st-s3" }]),
    ).rejects.toThrow(/Conflicting/);
    expect(await readLessonEvents()).toEqual([attempt("att-1")]);
  });

  it("round-trips checkpoints per pack and lesson", async () => {
    expect(await readCheckpoint(null, "it-variety-pilot", "it-cafe-story")).toBeNull();
    await writeCheckpoint(checkpoint({ draft: { kind: "text", text: "Un caff" } }), null);
    expect(await readCheckpoint(null, "it-variety-pilot", "it-cafe-story")).toEqual(
      checkpoint({ draft: { kind: "text", text: "Un caff" } }),
    );
    expect(await readCheckpoint(null, "it-variety-pilot", "other")).toBeNull();
  });

  it("lists every draft newest first, and skips one it cannot read", async () => {
    // The dashboard asks "where did this learner stop" once, not once per
    // lesson: listing drafts is what keeps that a single storage round-trip.
    await writeCheckpoint(checkpoint({ lessonId: "it-cafe-story", at: "2026-09-08T10:00:00.000Z" }), null);
    await writeCheckpoint(checkpoint({ lessonId: "it-cafe-listening", at: "2026-09-09T10:00:00.000Z" }), null);

    const drafts = await readCheckpoints(null);
    expect(drafts.map((draft) => draft.lessonId)).toEqual(["it-cafe-listening", "it-cafe-story"]);

    // A row written by an older build must never break the whole listing.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verbalibera-course-practice");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("checkpoints", "readwrite");
      tx.objectStore("checkpoints").put({
        packId: "it-variety-pilot",
        lessonId: "it-cafe-other",
        key: "it-variety-pilot:it-cafe-other",
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    expect((await readCheckpoints(null)).map((draft) => draft.lessonId)).toEqual([
      "it-cafe-listening",
      "it-cafe-story",
    ]);
    expect(await readCheckpoints("someone-elses-account")).toEqual([]);
  });
});

describe("portable lesson practice", () => {
  beforeEach(async () => {
    await deleteDatabase("verbalibera-portable-practice");
  });

  it("persists lesson events and checkpoints when IndexedDB works", async () => {
    const store = await probeLessonPractice({ indexedDB });
    await store.writeLessons([attempt("p-att-1")]);
    expect(await store.readLessons()).toEqual([attempt("p-att-1")]);
    await store.writeCheckpoint(checkpoint({}));
    expect(await store.readCheckpoint("it-variety-pilot", "it-cafe-story")).toEqual(
      checkpoint({}),
    );
  });

  it("falls back to memory without IndexedDB", async () => {
    const store = await probeLessonPractice({ indexedDB: undefined });
    await store.writeLessons([attempt("m-att-1")]);
    expect(await store.readLessons()).toEqual([attempt("m-att-1")]);
  });
});
