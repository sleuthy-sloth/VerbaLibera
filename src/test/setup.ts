import '@testing-library/jest-dom/vitest';

// Node 25+ installs a globalThis.localStorage accessor that resolves to undefined
// unless the process runs with --localstorage-file. That undefined shadows the
// Storage object jsdom installs, so replace the global whenever it is missing or
// unusable — a `undefined` global is just as fatal as a present-but-broken one.
//
// Read it off globalThis rather than the bare `localStorage` identifier: the
// node-environment suites (desktop lifecycle, portable builder, postgres runtime)
// have no jsdom global to read, and a bare read can throw ReferenceError while the
// setup file runs — which fails the whole file at collection time, before a single
// test executes.
const existing = (globalThis as { localStorage?: Storage }).localStorage;
if (!existing || typeof existing.setItem !== 'function') {
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
