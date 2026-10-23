import {Movie, MovieSummary, WatchlistEntry} from '../types.live';
import {readJson, storageKey, writeJson} from './storage';

const WATCHLIST_KEY = storageKey('watchlist');
export const WATCHLIST_LIMIT = 100;

function isValidEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<WatchlistEntry>;
  return (
    typeof entry.id === 'number' &&
    typeof entry.title === 'string' &&
    typeof entry.addedAt === 'number' &&
    (entry.year == null || typeof entry.year === 'number') &&
    (entry.rating == null || typeof entry.rating === 'number') &&
    (entry.posterUrl == null || typeof entry.posterUrl === 'string') &&
    (entry.providerName == null || typeof entry.providerName === 'string')
  );
}

function toEntry(
  movie: Movie | MovieSummary,
  now: number,
): WatchlistEntry {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year,
    rating: movie.rating,
    posterUrl: movie.posterUrl,
    providerName: movie.providerLabel,
    addedAt: now,
  };
}

export function isInWatchlist(
  list: WatchlistEntry[],
  id: number,
): boolean {
  return list.some((entry) => entry.id === id);
}

/**
 * Add or remove a title. Newest first, capped, and idempotent: pressing twice
 * returns the original list.
 */
export function toggleWatchlist(
  current: WatchlistEntry[],
  movie: Movie | MovieSummary,
  now: number = Date.now(),
): WatchlistEntry[] {
  if (isInWatchlist(current, movie.id)) {
    return current.filter((entry) => entry.id !== movie.id);
  }
  return [toEntry(movie, now), ...current].slice(0, WATCHLIST_LIMIT);
}

export async function loadWatchlist(): Promise<WatchlistEntry[]> {
  const stored = await readJson<unknown>(WATCHLIST_KEY, []);
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored
    .filter(isValidEntry)
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, WATCHLIST_LIMIT);
}

export async function saveWatchlist(
  list: WatchlistEntry[],
): Promise<void> {
  await writeJson(WATCHLIST_KEY, list.slice(0, WATCHLIST_LIMIT));
}
