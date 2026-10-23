import {
  isInWatchlist,
  loadWatchlist,
  saveWatchlist,
  toggleWatchlist,
  WATCHLIST_LIMIT,
} from '../src/services/watchlist';
import {MovieSummary, WatchlistEntry} from '../src/types.live';
import {setStorageBackend} from '../src/services/storage';
import {createMemoryStorage} from './helpers/memoryStorage';

const movie: MovieSummary = {
  id: 42,
  title: 'A Cozy Film',
  year: 2024,
  rating: 7.4,
  voteCount: 100,
  overview: 'Something warm.',
  posterUrl: 'https://example.test/poster.jpg',
  backdropUrl: null,
  genreIds: [35],
  providerLabel: 'Prime Video',
  availability: [],
};

describe('watchlist', () => {
  let storage = createMemoryStorage();

  beforeEach(() => {
    storage = createMemoryStorage();
    setStorageBackend(storage);
  });

  afterEach(() => {
    setStorageBackend(null);
  });

  it('adds newest first and toggles off', () => {
    const added = toggleWatchlist([], movie, 1000);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      id: 42,
      title: 'A Cozy Film',
      year: 2024,
      providerName: 'Prime Video',
      addedAt: 1000,
    });
    expect(isInWatchlist(added, 42)).toBe(true);

    const removed = toggleWatchlist(added, movie, 2000);
    expect(removed).toEqual([]);
  });

  it('caps the list and keeps the newest entries', () => {
    let list: WatchlistEntry[] = [];
    for (let i = 0; i < WATCHLIST_LIMIT + 5; i += 1) {
      list = toggleWatchlist(list, {...movie, id: i}, i);
    }
    expect(list).toHaveLength(WATCHLIST_LIMIT);
    expect(list[0].id).toBe(WATCHLIST_LIMIT + 4);
  });

  it('persists and restores, dropping corrupt entries', async () => {
    const saved = toggleWatchlist([], movie, 10);
    await saveWatchlist(saved);

    expect(await loadWatchlist()).toEqual(saved);

    storage.dump().set(
      'ynb:v2:watchlist',
      JSON.stringify([{id: 'bad'}, saved[0]]),
    );
    expect(await loadWatchlist()).toEqual(saved);
  });

  it('returns an empty list for unreadable storage', async () => {
    storage.dump().set('ynb:v2:watchlist', 'not json');
    expect(await loadWatchlist()).toEqual([]);
  });
});
