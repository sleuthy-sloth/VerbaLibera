import '@testing-library/jest-dom/vitest';

// Node 25 provides a minimal globalThis.localStorage that lacks setItem/getItem/clear.
// Replace it with a proper in-memory implementation so vitest jsdom tests can use it.
//
// Read it off globalThis rather than the bare `localStorage` identifier: suites
// that opt into the node environment (desktop lifecycle, portable builder,
// postgres runtime) have no such global at all, and a bare read throws
// ReferenceError while the setup file runs — which fails the whole file at
// collection time, before a single test executes. Those suites keep their
// environment untouched.
const existing = (globalThis as { localStorage?: Storage }).localStorage;
if (existing && typeof existing.setItem !== 'function') {
  const store = new Map<string, string>();
  const localStorageShim: Storage = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.get(key) ?? null; },
    key(index: number) { return [...store.keys()][index] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, String(value)); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageShim, configurable: true, writable: true });
}
