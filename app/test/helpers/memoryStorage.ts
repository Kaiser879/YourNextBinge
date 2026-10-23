import {StorageBackend} from '../../src/services/storage';

export interface MemoryStorage extends StorageBackend {
  dump(): Map<string, string>;
  clear(): void;
}

export function createMemoryStorage(seed?: Record<string, string>): MemoryStorage {
  const data = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
    dump: () => data,
    clear: () => data.clear(),
  };
}
