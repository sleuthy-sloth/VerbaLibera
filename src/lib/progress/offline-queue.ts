/**
 * Offline review queue — IndexedDB with localStorage fallback.
 *
 * Persists optimistic reviews when navigator.onLine === false and replays
 * them with idempotent clientMutationId when connectivity returns.
 * Store name must be `reviewQueue` per Task 15 contract.
 */

export const DB_NAME = 'verbalibera-offline';
export const DB_VERSION = 1;
export const REVIEW_QUEUE_STORE = 'reviewQueue';
export const LS_KEY = 'verbalibera:reviewQueue';

export type ReviewVerdict = 'exact' | 'close' | 'try_again';

export type QueuedReview = Readonly<{
  id: string;
  drillItemId: string;
  verdict: ReviewVerdict;
  latencyMs: number | null;
  clientMutationId: string;
  enqueuedAt: number;
}>;

export type ReviewInput = Readonly<{
  drillItemId: string;
  verdict: ReviewVerdict;
  latencyMs?: number | null;
  clientMutationId?: string;
}>;

function generateId(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof (c as { randomUUID?: () => string }).randomUUID === 'function') {
      return (c as { randomUUID: () => string }).randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeInput(input: ReviewInput): QueuedReview {
  const clientMutationId = input.clientMutationId?.trim()
    ? input.clientMutationId.trim()
    : `${input.drillItemId}-${generateId()}`;
  return {
    id: clientMutationId,
    drillItemId: input.drillItemId,
    verdict: input.verdict,
    latencyMs: input.latencyMs ?? null,
    clientMutationId,
    enqueuedAt: Date.now(),
  };
}

function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
  } catch {
    return false;
  }
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as unknown as { localStorage?: Storage };
      if (g.localStorage && typeof g.localStorage.getItem === 'function') return g.localStorage;
    }
    if (typeof localStorage !== 'undefined' && typeof (localStorage as unknown as Storage).getItem === 'function') {
      return localStorage as unknown as Storage;
    }
  } catch {
    return null;
  }
  return null;
}

function canUseLocalStorage(): boolean {
  return getStorage() !== null;
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return null;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(REVIEW_QUEUE_STORE)) {
          db.createObjectStore(REVIEW_QUEUE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll(): Promise<QueuedReview[] | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REVIEW_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(REVIEW_QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as QueuedReview[]) ?? []);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      // fallback close on error
      tx.onerror = () => {
        try {
          db.close();
        } catch {}
        resolve(null);
      };
    } catch {
      try {
        db.close();
      } catch {}
      resolve(null);
    }
  });
}

async function idbPut(entry: QueuedReview): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(REVIEW_QUEUE_STORE);
      const req = store.put(entry);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try {
          db.close();
        } catch {}
        resolve(false);
      };
    } catch {
      try {
        db.close();
      } catch {}
      resolve(false);
    }
  });
}

async function idbDelete(id: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(REVIEW_QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try {
          db.close();
        } catch {}
        resolve(false);
      };
    } catch {
      try {
        db.close();
      } catch {}
      resolve(false);
    }
  });
}

async function idbClear(): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REVIEW_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(REVIEW_QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        try {
          db.close();
        } catch {}
        resolve(false);
      };
    } catch {
      try {
        db.close();
      } catch {}
      resolve(false);
    }
  });
}

function lsGetAll(): QueuedReview[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function lsSetAll(entries: QueuedReview[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LS_KEY, JSON.stringify(entries));
  } catch {
    // quota or unavailable — ignore, caller will handle in-memory fallback
  }
}

// In-memory fallback when neither IDB nor localStorage is available (e.g., some test envs)
let memoryQueue: QueuedReview[] | null = null;

function getMemoryQueue(): QueuedReview[] {
  if (memoryQueue) return memoryQueue;
  memoryQueue = [];
  return memoryQueue;
}

export async function getQueuedReviews(): Promise<QueuedReview[]> {
  // Try IndexedDB first
  const idb = await idbGetAll();
  if (idb !== null) return idb;

  // Fallback to localStorage
  if (canUseLocalStorage()) {
    return lsGetAll();
  }

  // In-memory fallback
  return [...getMemoryQueue()];
}

export async function enqueueReview(input: ReviewInput): Promise<QueuedReview> {
  const entry = normalizeInput(input);

  // Try IDB
  const idbEntries = await idbGetAll();
  if (idbEntries !== null) {
    // Dedupe by clientMutationId — idempotency guard
    const exists = idbEntries.some((e) => e.clientMutationId === entry.clientMutationId || e.id === entry.id);
    if (exists) {
      return idbEntries.find((e) => e.clientMutationId === entry.clientMutationId || e.id === entry.id)!;
    }
    const ok = await idbPut(entry);
    if (ok) return entry;
    // if put failed, fall through to LS
  }

  if (canUseLocalStorage()) {
    const entries = lsGetAll();
    const exists = entries.some((e) => e.clientMutationId === entry.clientMutationId || e.id === entry.id);
    if (exists) {
      return entries.find((e) => e.clientMutationId === entry.clientMutationId || e.id === entry.id)!;
    }
    entries.push(entry);
    lsSetAll(entries);
    return entry;
  }

  // In-memory fallback
  const mem = getMemoryQueue();
  const exists = mem.some((e) => e.clientMutationId === entry.clientMutationId || e.id === entry.id);
  if (exists) {
    return mem.find((e) => e.clientMutationId === entry.clientMutationId || e.id === entry.id)!;
  }
  mem.push(entry);
  return entry;
}

export async function dequeueReview(id: string): Promise<void> {
  const idbEntries = await idbGetAll();
  if (idbEntries !== null) {
    await idbDelete(id);
    // Also ensure LS copy is cleaned if it exists (migration case)
    if (canUseLocalStorage()) {
      const lsEntries = lsGetAll();
      if (lsEntries.some((e) => e.id === id || e.clientMutationId === id)) {
        lsSetAll(lsEntries.filter((e) => e.id !== id && e.clientMutationId !== id));
      }
    }
    return;
  }

  if (canUseLocalStorage()) {
    const entries = lsGetAll();
    const filtered = entries.filter((e) => e.id !== id && e.clientMutationId !== id);
    if (filtered.length !== entries.length) {
      lsSetAll(filtered);
    }
    return;
  }

  const mem = getMemoryQueue();
  const idx = mem.findIndex((e) => e.id === id || e.clientMutationId === id);
  if (idx !== -1) mem.splice(idx, 1);
}

export async function clearQueuedReviews(): Promise<void> {
  const idbEntries = await idbGetAll();
  if (idbEntries !== null) {
    await idbClear();
  }
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(LS_KEY);
    } catch {}
  }
  if (memoryQueue) memoryQueue = [];
}

/**
 * Replay all queued reviews against /api/progress/review.
 * Uses idempotent clientMutationId so server will dedupe duplicate POSTs.
 * On success (2xx) the entry is dequeued; on failure it stays for next retry.
 */
export async function replayQueuedReviews(options?: { fetchFn?: typeof fetch }): Promise<{ succeeded: number; failed: number }> {
  const fetchFn = options?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) return { succeeded: 0, failed: 0 };

  const queued = await getQueuedReviews();
  if (queued.length === 0) return { succeeded: 0, failed: 0 };

  let succeeded = 0;
  let failed = 0;

  // Sequential replay to preserve order and avoid thundering
  for (const entry of queued) {
    try {
      const response = await fetchFn('/api/progress/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drillItemId: entry.drillItemId,
          verdict: entry.verdict,
          latencyMs: entry.latencyMs,
          clientMutationId: entry.clientMutationId,
        }),
      });
      if (response.ok) {
        await dequeueReview(entry.id);
        succeeded += 1;
      } else {
        // 4xx validation errors are not retried — dequeue to avoid infinite loop,
        // except 401/403/429/5xx which are transient/retriable.
        // For offline queue we keep 401/403/5xx for retry and drop 400 invalid_request.
        if (response.status === 400 || response.status === 422) {
          await dequeueReview(entry.id);
          failed += 1;
        } else {
          failed += 1;
        }
      }
    } catch {
      failed += 1;
    }
  }

  return { succeeded, failed };
}

/**
 * Register a window 'online' listener that replays the queue.
 * Returns an unsubscribe function. Safe to call in any environment — no-ops on server.
 */
export function setupOfflineQueueSync(onReplay?: (result: { succeeded: number; failed: number }) => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  const handleOnline = async () => {
    try {
      const result = await replayQueuedReviews();
      onReplay?.(result);
      // Dispatch a custom event for UI layers to react (e.g., invalidation)
      try {
        window.dispatchEvent(new CustomEvent('verbalibera:queue-replayed', { detail: result }));
      } catch {}
    } catch {
      // swallow — will retry on next online
    }
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}

export function isOnline(): boolean {
  try {
    return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  } catch {
    return true;
  }
}
