import { IDBDatabase, indexedDB } from "fake-indexeddb";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PracticeEvent } from "@/features/course-pack/progress";
import {
  createPortableEnvironment,
  probePortableStore,
} from "@/features/course-pack/portable-environment";
import { validatePack } from "@/features/course-pack/schema";
import type { PortableContent } from "../scripts/portable/content";

const first: PracticeEvent = {
  id: "portable-first",
  packId: "it-foundations",
  version: "1.0.0",
  exerciseId: "it-greetings-meet",
  at: "2026-09-06T00:00:00.000Z",
  correct: true,
  revealed: false,
};

const second: PracticeEvent = {
  ...first,
  id: "portable-second",
  at: "2026-09-06T00:01:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("portable practice storage", () => {
  it("uses temporary memory storage when IndexedDB is unavailable", async () => {
    const store = await probePortableStore({ indexedDB: undefined });

    expect(store.getDurability()).toBe("temporary");
    await store.write([first]);
    expect(await store.read()).toEqual([first]);
  });

  it("proves IndexedDB persistence before reporting durable", async () => {
    const store = await probePortableStore({ indexedDB });

    expect(store.getDurability()).toBe("durable");
    await store.write([first]);
    expect(await store.read()).toEqual([first]);
  });

  it("falls back with prior events when a later transaction fails", async () => {
    const store = await probePortableStore({ indexedDB });
    await store.write([first]);
    const durabilityChanges: string[] = [];
    store.subscribeDurability((value) => durabilityChanges.push(value));
    const transaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(
      function (this: IDBDatabase, names, mode, options) {
        if (mode === "readwrite" && names === "events") {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return transaction.call(this, names, mode, options);
      },
    );

    await expect(store.write([second])).rejects.toThrow(/not saved/i);
    expect(store.getDurability()).toBe("temporary");
    expect(durabilityChanges).toEqual(["temporary"]);
    expect(await store.read()).toEqual([first]);
  });
});

describe("portable course assets", () => {
  it("loads embedded packs and turns embedded media into blob URLs", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:portable-audio"),
    });
    const pack = validatePack(
      JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")),
    );
    const mediaPath = pack.media[0].url;
    const content: PortableContent = {
      packs: { italian: pack },
      assets: {
        [mediaPath]: {
          mime: "audio/wav",
          sha256: pack.media[0].sha256,
          base64: "aGVsbG8=",
        },
      },
    };

    const environment = await createPortableEnvironment(content, {
      indexedDB: undefined,
    });

    expect((await environment.loadPack("italian")).id).toBe(pack.id);
    expect(environment.resolveMedia(mediaPath)).toBe("blob:portable-audio");
    await expect(environment.loadPack("french")).rejects.toThrow(
      /not embedded/i,
    );
  });
});
