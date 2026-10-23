import {
  cacheKey,
  clearMemoryCache,
  readThrough,
} from '../src/services/tmdbCache';
import {setStorageBackend} from '../src/services/storage';
import {createMemoryStorage} from './helpers/memoryStorage';

describe('tmdbCache', () => {
  let storage = createMemoryStorage();

  beforeEach(() => {
    storage = createMemoryStorage();
    setStorageBackend(storage);
    clearMemoryCache();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    setStorageBackend(null);
  });

  it('caches in memory within the TTL', async () => {
    const loader = jest.fn(async () => ['a']);
    const key = cacheKey(['trending', 'IN']);

    expect(await readThrough(key, 1000, loader)).toEqual(['a']);
    jest.setSystemTime(new Date('2026-10-23T10:00:00.500Z'));
    expect(await readThrough(key, 1000, loader)).toEqual(['a']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads after the TTL expires', async () => {
    const loader = jest
      .fn()
      .mockResolvedValueOnce(['a'])
      .mockResolvedValueOnce(['b']);
    const key = cacheKey(['trending', 'IN']);

    expect(await readThrough(key, 1000, loader)).toEqual(['a']);
    jest.setSystemTime(new Date('2026-10-23T10:00:02Z'));
    expect(await readThrough(key, 1000, loader)).toEqual(['b']);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('persists normalized values across a cold memory cache', async () => {
    jest.useRealTimers();
    const loader = jest.fn(async () => ({title: 'Saved'}));
    const key = cacheKey(['movie', 42, 'IN']);

    expect(await readThrough(key, 60_000, loader, {persist: true})).toEqual({
      title: 'Saved',
    });
    // Persistence is intentionally fire-and-forget; let it settle.
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 20));

    clearMemoryCache();
    expect(await readThrough(key, 60_000, loader, {persist: true})).toEqual({
      title: 'Saved',
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('ignores a corrupt persisted envelope', async () => {
    jest.useRealTimers();
    const loader = jest.fn(async () => 'fresh');
    const key = cacheKey(['providers', 'IN']);
    storage.dump().set(key, '{"v":1,"at":');

    expect(await readThrough(key, 60_000, loader)).toBe('fresh');
  });
});
