/**
 * Small read-through cache: memory first, then AsyncStorage, then the loader.
 *
 * Only normalized payloads are persisted (never raw TMDB responses) so keys
 * stay small enough for AsyncStorage. TTLs are enforced against the time the
 * value was written, so a cached row does not stay fresh forever.
 */
import {readJson, storageKey, writeJson} from './storage';

interface MemoryEntry {
  at: number;
  value: unknown;
}

interface PersistedEnvelope<T> {
  v: 1;
  at: number;
  data: T;
}

const CACHE_INDEX_KEY = storageKey('cache:index');
const MAX_MEMORY_ENTRIES = 50;
const MAX_PERSISTED_ENTRIES = 40;

const memory = new Map<string, MemoryEntry>();

export function clearMemoryCache(): void {
  memory.clear();
}

export function cacheKey(parts: Array<string | number | boolean | null | undefined>): string {
  return storageKey(
    `cache:${parts
      .filter((part) => part != null && part !== '')
      .map((part) => String(part))
      .join('|')}`,
  );
}

function readMemory<T>(key: string, ttlMs: number): T | undefined {
  const entry = memory.get(key);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.at >= ttlMs) {
    memory.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function remember<T>(key: string, value: T): void {
  // Insertion order is our LRU proxy; refreshing a key moves it to the end.
  memory.delete(key);
  memory.set(key, {at: Date.now(), value});
  while (memory.size > MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest == null) {
      break;
    }
    memory.delete(oldest);
  }
}

async function readIndex(): Promise<Array<{key: string; at: number}>> {
  const parsed = await readJson<unknown>(CACHE_INDEX_KEY, []);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(
    (entry): entry is {key: string; at: number} =>
      typeof entry === 'object' &&
      entry != null &&
      typeof (entry as {key?: unknown}).key === 'string' &&
      typeof (entry as {at?: unknown}).at === 'number',
  );
}

async function persist<T>(key: string, value: T): Promise<void> {
  const envelope: PersistedEnvelope<T> = {v: 1, at: Date.now(), data: value};
  await writeJson(key, envelope);

  const index = await readIndex();
  const next = index.filter((entry) => entry.key !== key);
  next.push({key, at: envelope.at});

  while (next.length > MAX_PERSISTED_ENTRIES) {
    const evicted = next.shift();
    if (evicted) {
      await writeJson(evicted.key, null);
    }
  }
  await writeJson(CACHE_INDEX_KEY, next);
}

async function readPersisted<T>(key: string, ttlMs: number): Promise<T | undefined> {
  const envelope = await readJson<PersistedEnvelope<T> | null>(key, null);
  if (!envelope || envelope.v !== 1 || typeof envelope.at !== 'number') {
    return undefined;
  }
  if (Date.now() - envelope.at >= ttlMs) {
    return undefined;
  }
  return envelope.data;
}

export interface ReadThroughOptions {
  /** Persist the loader result for the next cold start. Defaults false. */
  persist?: boolean;
}

export async function readThrough<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  opts: ReadThroughOptions = {},
): Promise<T> {
  const fromMemory = readMemory<T>(key, ttlMs);
  if (fromMemory !== undefined) {
    return fromMemory;
  }

  const fromDisk = await readPersisted<T>(key, ttlMs);
  if (fromDisk !== undefined) {
    remember(key, fromDisk);
    return fromDisk;
  }

  const value = await loader();
  remember(key, value);
  if (opts.persist) {
    // Cache writes must never delay or fail the request.
    void persist(key, value);
  }
  return value;
}
