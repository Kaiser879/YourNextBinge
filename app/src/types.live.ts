/**
 * Domain types for the live (TMDB-backed) side of the app.
 *
 * Kept separate from `types.ts` so the bundled v1 catalog and its offline
 * recommender remain untouched.
 */

export type Region = string;

/** TMDB monetization buckets. `free` and `ads` still count as "stream". */
export type Monetization = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';

export interface Provider {
  id: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
}

export interface AvailabilityEntry {
  providerId: number;
  providerName: string;
  type: Monetization;
}

export interface ImageConfig {
  baseUrl: string;
  posterSize: string;
  backdropSize: string;
}

/** A list-row item. Deliberately light: overviews are fetched on detail only. */
export interface MovieSummary {
  id: number;
  title: string;
  year: number | null;
  rating: number | null;
  voteCount: number;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  genreIds: number[];
  /** Top provider name for a row badge, when known. */
  providerLabel: string | null;
  /** Empty for list endpoints; populated on detail. */
  availability: AvailabilityEntry[];
}

export interface Movie extends MovieSummary {
  runtime: number | null;
  genres: string[];
  trailerKey: string | null;
  region: Region;
}

export interface WatchlistEntry {
  id: number;
  title: string;
  year: number | null;
  rating: number | null;
  posterUrl: string | null;
  providerName: string | null;
  /** Epoch ms. Newest first when rendered. */
  addedAt: number;
}

export interface Settings {
  version: 1;
  region: Region;
  providerIds: number[];
  /** False until first-run provider defaults have been applied. */
  initialized: boolean;
}

export interface ImageConfigRaw {
  baseUrl: string;
}

export interface DiscoverRow {
  items: MovieSummary[];
  page: number;
  totalPages: number;
}

export type SearchMode = 'semantic' | 'keyword' | 'local';

export type SearchState =
  | {status: 'idle'}
  | {status: 'loading'; query: string}
  | {
      status: 'results';
      query: string;
      mode: SearchMode;
      items: MovieSummary[];
      tookMs: number;
    }
  | {status: 'error'; query: string; message: string};
