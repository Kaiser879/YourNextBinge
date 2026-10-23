/**
 * Thin persistence layer over the Vega AsyncStorage module.
 *
 * Everything the app persists (settings, watchlist, TMDB cache) goes through
 * here so tests can swap in an in-memory backend and so a storage failure can
 * never take down a screen.
 *
 * NOTE: the legacy `AsyncStorage` export on the kepler package is deprecated
 * and its native backend is not present on the VVD (writes fail silently).
 * Use the supported package below.
 */
import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';

export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const keplerBackend: StorageBackend = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

let backend: StorageBackend = keplerBackend;

/** Tests inject an in-memory backend; pass null to restore the platform one. */
export function setStorageBackend(next: StorageBackend | null): void {
  backend = next ?? keplerBackend;
}

export const STORAGE_PREFIX = 'ynb:v2';

export function storageKey(suffix: string): string {
  return `${STORAGE_PREFIX}:${suffix}`;
}

export async function readRaw(key: string): Promise<string | null> {
  try {
    return await backend.getItem(key);
  } catch (error) {
    console.warn(`[YNB] storage read failed: ${key}`, error);
    return null;
  }
}

export async function writeRaw(key: string, value: string): Promise<void> {
  try {
    await backend.setItem(key, value);
  } catch (error) {
    console.warn(`[YNB] storage write failed: ${key}`, error);
  }
}

export async function removeRaw(key: string): Promise<void> {
  try {
    await backend.removeItem(key);
  } catch (error) {
    console.warn(`[YNB] storage remove failed: ${key}`, error);
  }
}

/**
 * Read a JSON value with a typed fallback. Corrupt or missing data is treated
 * as absent — persistence must never be able to crash the UI.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await readRaw(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[YNB] corrupt JSON at ${key}`, error);
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await writeRaw(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[YNB] JSON write failed: ${key}`, error);
  }
}
