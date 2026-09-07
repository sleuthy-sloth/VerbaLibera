import type {
  CourseEnvironment,
  PracticeDurability,
  PracticeStore,
} from "./environment";
import { mergeEvents, type PracticeEvent } from "./progress";
import { validatePack } from "./schema";
import type { PortableContent } from "../../../scripts/portable/content";

const DATABASE_NAME = "verbalibera-portable-practice";
const DATABASE_VERSION = 1;

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
