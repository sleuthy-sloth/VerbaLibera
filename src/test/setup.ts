import '@testing-library/jest-dom/vitest';

// Node 25 provides a minimal globalThis.localStorage that lacks setItem/getItem/clear.
// Replace it with a proper in-memory implementation so vitest jsdom tests can use it.
if (!localStorage.setItem) {
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
