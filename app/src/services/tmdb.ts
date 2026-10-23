/**
 * TMDB v3 client.
 *
 * Design rules:
 *  - no network at import time;
 *  - every call takes a region (the UI fixes it to IN, the code does not);
 *  - responses are mapped to the small domain types in `types.live.ts`
 *    before they are cached, keeping AsyncStorage payloads tiny;
 *  - failures are typed so screens can distinguish "offline" from "bad key".
 */
import {FALLBACK_IMAGE_BASE, IMAGE_SIZES, config} from '../config';
import {
  AvailabilityEntry,
  ImageConfig,
  Monetization,
  Movie,
  MovieSummary,
  Provider,
} from '../types.live';
import {cacheKey, readThrough} from './tmdbCache';
import {topProvider} from './availability';

const API_BASE = 'https://api.themoviedb.org/3';
const REQUEST_TIMEOUT_MS = 8000;
const ROW_LIMIT = 14;
const MONETIZATION_TYPES: Monetization[] = [
  'flatrate',
  'free',
  'ads',
  'rent',
  'buy',
];

const TTL = {
  configuration: 7 * 24 * 60 * 60 * 1000,
  providers: 7 * 24 * 60 * 60 * 1000,
  row: 24 * 60 * 60 * 1000,
  detail: 24 * 60 * 60 * 1000,
};

export type TmdbErrorKind = 'network' | 'http' | 'parse' | 'config';

export class TmdbError extends Error {
  readonly kind: TmdbErrorKind;
  readonly status?: number;

  constructor(kind: TmdbErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'TmdbError';
    this.kind = kind;
    this.status = status;
  }
}

export interface TmdbClient {
  getConfiguration(): Promise<ImageConfig>;
  getProviders(region: string): Promise<Provider[]>;
  getTrending(region: string, limit?: number): Promise<MovieSummary[]>;
  getOnServices(
    region: string,
    providerIds: number[],
    limit?: number,
  ): Promise<MovieSummary[]>;
  getDiscoverPool(
    region: string,
    page: number,
    providerIds?: number[],
  ): Promise<MovieSummary[]>;
  getMovie(id: number, region: string): Promise<Movie>;
  searchMovies(query: string, region: string): Promise<MovieSummary[]>;
  getRecommendations(id: number, region: string): Promise<MovieSummary[]>;
}

// --- raw response shapes (only the fields we use) ---------------------------

interface RawMovie {
  id: number;
  title?: string;
  release_date?: string;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  runtime?: number | null;
  genres?: Array<{id: number; name: string}>;
}

interface RawProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
  display_priority?: number;
}

interface RawAvailabilityBlock {
  link?: string;
  flatrate?: RawProviderEntry[];
  free?: RawProviderEntry[];
  ads?: RawProviderEntry[];
  rent?: RawProviderEntry[];
  buy?: RawProviderEntry[];
}

interface RawDetail extends RawMovie {
  'watch/providers'?: {
    results?: Record<string, RawAvailabilityBlock>;
  };
  videos?: {
    results?: Array<{
      key?: string;
      site?: string;
      type?: string;
      official?: boolean;
      iso_639_1?: string;
      published_at?: string;
    }>;
  };
}

interface RawDiscover {
  page: number;
  total_pages: number;
  results: RawMovie[];
}

interface RawConfiguration {
  images?: {
    secure_base_url?: string;
    base_url?: string;
    poster_sizes?: string[];
    backdrop_sizes?: string[];
  };
}

interface RawProviderList {
  results?: RawProviderEntry[];
}

// --- helpers ----------------------------------------------------------------

type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(params: Record<string, QueryValue>): string {
  return Object.keys(params)
    .filter((key) => {
      const value = params[key];
      return value != null && value !== '';
    })
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`,
    )
    .join('&');
}

export function imageUrl(
  path: string | null | undefined,
  size: string,
  imageConfig?: ImageConfig | null,
): string | null {
  if (!path) {
    return null;
  }
  const base = imageConfig?.baseUrl ?? FALLBACK_IMAGE_BASE;
  return `${base}${size}${path}`;
}

function yearFromDate(date: string | null | undefined): number | null {
  if (!date || date.length < 4) {
    return null;
  }
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

function ratingOf(raw: RawMovie): number | null {
  const rating = raw.vote_average;
  const votes = raw.vote_count ?? 0;
  if (rating == null || !Number.isFinite(rating) || rating <= 0 || votes <= 0) {
    return null;
  }
  return Math.round(rating * 10) / 10;
}

export function mapMovieSummary(
  raw: RawMovie,
  imageConfig?: ImageConfig | null,
  providerLabel: string | null = null,
): MovieSummary {
  return {
    id: raw.id,
    title: raw.title ?? 'Untitled',
    year: yearFromDate(raw.release_date),
    rating: ratingOf(raw),
    voteCount: raw.vote_count ?? 0,
    overview: raw.overview ?? '',
    posterUrl: imageUrl(raw.poster_path, IMAGE_SIZES.poster, imageConfig),
    backdropUrl: imageUrl(raw.backdrop_path, IMAGE_SIZES.backdrop, imageConfig),
    genreIds: raw.genre_ids ?? [],
    providerLabel,
    availability: [],
  };
}

const MONETIZATION_GROUPS: Monetization[] = [
  'flatrate',
  'free',
  'ads',
  'rent',
  'buy',
];

export function mapAvailability(
  block: RawAvailabilityBlock | null | undefined,
): AvailabilityEntry[] {
  if (!block) {
    return [];
  }
  const entries: AvailabilityEntry[] = [];
  MONETIZATION_GROUPS.forEach((type) => {
    (block[type] ?? []).forEach((entry) => {
      if (!entry || typeof entry.provider_id !== 'number') {
        return;
      }
      entries.push({
        providerId: entry.provider_id,
        providerName: entry.provider_name,
        type,
      });
    });
  });
  return entries;
}

export function pickTrailerKey(raw: RawDetail): string | null {
  const videos = raw.videos?.results ?? [];
  const candidates = videos.filter(
    (video) =>
      video &&
      video.site === 'YouTube' &&
      typeof video.key === 'string' &&
      video.key.length > 0 &&
      (video.type === 'Trailer' || video.type === 'Teaser'),
  );
  if (candidates.length === 0) {
    return null;
  }
  const score = (video: (typeof candidates)[number]): number => {
    let value = 0;
    if (video.type === 'Trailer') {
      value += 10;
    }
    if (video.official) {
      value += 10;
    }
    if (video.iso_639_1 === 'en') {
      value += 3;
    }
    return value;
  };
  candidates.sort((a, b) => {
    const delta = score(b) - score(a);
    if (delta !== 0) {
      return delta;
    }
    return (b.published_at ?? '').localeCompare(a.published_at ?? '');
  });
  return candidates[0].key ?? null;
}

export function mapProvider(raw: RawProviderEntry): Provider {
  return {
    id: raw.provider_id,
    name: raw.provider_name,
    logoPath: raw.logo_path ?? null,
    displayPriority:
      typeof raw.display_priority === 'number' ? raw.display_priority : 9999,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface TmdbClientOptions {
  /** v3 API key. Ignored when accessToken is present. */
  apiKey?: string;
  /** v4 read access token (JWT). Preferred when both are supplied. */
  accessToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createTmdbClient(opts: TmdbClientOptions): TmdbClient {
  const apiKey = (opts.apiKey ?? '').trim();
  const accessToken = (opts.accessToken ?? '').trim();
  if (!apiKey && !accessToken) {
    throw new TmdbError('config', 'TMDB API key or access token is required');
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;

  async function request<T>(
    path: string,
    params: Record<string, QueryValue>,
  ): Promise<T> {
    // A v4 token authenticates via Bearer header; a v3 key goes in the query.
    const url = accessToken
      ? `${API_BASE}${path}?${buildQuery(params)}`
      : `${API_BASE}${path}?${buildQuery({...params, api_key: apiKey})}`;
    const headers = accessToken
      ? {Authorization: `Bearer ${accessToken}`}
      : undefined;

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          signal: controller.signal,
          headers,
        });
        if (!response.ok) {
          throw new TmdbError(
            'http',
            `TMDB ${response.status} for ${path}`,
            response.status,
          );
        }
        return (await response.json()) as T;
      } catch (error) {
        lastError = error;
        if (error instanceof TmdbError && error.kind === 'http') {
          if (attempt === 0 && (error.status ?? 0) >= 500) {
            await delay(250);
            continue;
          }
          throw error;
        }
        if (attempt === 0) {
          await delay(250);
          continue;
        }
        throw new TmdbError(
          'network',
          `TMDB request failed for ${path}: ${String(error)}`,
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new TmdbError('network', 'TMDB request failed');
  }

  async function getConfiguration(): Promise<ImageConfig> {
    return readThrough(
      cacheKey(['configuration']),
      TTL.configuration,
      async () => {
        const raw = await request<RawConfiguration>('/configuration', {});
        const baseUrl =
          raw.images?.secure_base_url ?? raw.images?.base_url ?? FALLBACK_IMAGE_BASE;
        return {
          baseUrl,
          posterSize: IMAGE_SIZES.poster,
          backdropSize: IMAGE_SIZES.backdrop,
        };
      },
      {persist: true},
    );
  }

  async function getProviders(region: string): Promise<Provider[]> {
    return readThrough(
      cacheKey(['providers', region]),
      TTL.providers,
      async () => {
        const raw = await request<RawProviderList>('/watch/providers/movie', {
          watch_region: region,
          language: 'en-US',
        });
        return (raw.results ?? [])
          .map(mapProvider)
          .sort(
            (a, b) =>
              a.displayPriority - b.displayPriority ||
              a.name.localeCompare(b.name),
          );
      },
      {persist: true},
    );
  }

  async function discover(
    region: string,
    page: number,
    providerIds?: number[],
  ): Promise<RawDiscover> {
    return request<RawDiscover>('/discover/movie', {
      watch_region: region,
      with_watch_monetization_types: MONETIZATION_TYPES.join('|'),
      with_watch_providers:
        providerIds && providerIds.length > 0
          ? providerIds.join('|')
          : undefined,
      sort_by: 'popularity.desc',
      'vote_count.gte': 20,
      include_adult: false,
      language: 'en-US',
      page,
    });
  }

  function mapRow(
    raw: RawMovie[],
    imageConfig: ImageConfig,
  ): MovieSummary[] {
    // Discover responses do not include per-title provider data. Row badges
    // are therefore only shown when we already know the provider (watchlist,
    // search index, or detail); full availability is a detail fetch.
    return raw.map((movie) => mapMovieSummary(movie, imageConfig));
  }

  async function getTrending(
    region: string,
    limit = ROW_LIMIT,
  ): Promise<MovieSummary[]> {
    return readThrough(
      cacheKey(['trending', region, limit]),
      TTL.row,
      async () => {
        const [imageConfig, discoverRaw] = await Promise.all([
          getConfiguration(),
          discover(region, 1),
        ]);
        return (mapRow(discoverRaw.results ?? [], imageConfig)).slice(
          0,
          limit,
        );
      },
      {persist: true},
    );
  }

  async function getOnServices(
    region: string,
    providerIds: number[],
    limit = ROW_LIMIT,
  ): Promise<MovieSummary[]> {
    if (providerIds.length === 0) {
      return [];
    }
    const ids = [...providerIds].sort((a, b) => a - b);
    return readThrough(
      cacheKey(['on-services', region, ids.join(','), limit]),
      TTL.row,
      async () => {
        const [imageConfig, discoverRaw] = await Promise.all([
          getConfiguration(),
          discover(region, 1, ids),
        ]);
        return (mapRow(discoverRaw.results ?? [], imageConfig)).slice(
          0,
          limit,
        );
      },
      {persist: true},
    );
  }

  async function getDiscoverPool(
    region: string,
    page: number,
    providerIds?: number[],
  ): Promise<MovieSummary[]> {
    const [imageConfig, discoverRaw] = await Promise.all([
      getConfiguration(),
      discover(region, page, providerIds),
    ]);
    return mapRow(discoverRaw.results ?? [], imageConfig);
  }

  async function getMovie(id: number, region: string): Promise<Movie> {
    return readThrough(
      cacheKey(['movie', id, region]),
      TTL.detail,
      async () => {
        const [imageConfig, raw] = await Promise.all([
          getConfiguration(),
          request<RawDetail>(`/movie/${id}`, {
            append_to_response: 'watch/providers,videos,keywords',
            language: 'en-US',
          }),
        ]);
        const block = raw['watch/providers']?.results?.[region];
        const availability = mapAvailability(block);
        const summary = mapMovieSummary(
          raw,
          imageConfig,
          topProvider(availability),
        );
        return {
          ...summary,
          availability,
          runtime:
            typeof raw.runtime === 'number' && raw.runtime > 0
              ? raw.runtime
              : null,
          genres: (raw.genres ?? []).map((genre) => genre.name),
          trailerKey: pickTrailerKey(raw),
          region,
        };
      },
      {persist: true},
    );
  }

  async function searchMovies(
    query: string,
    region: string,
  ): Promise<MovieSummary[]> {
    if (query.trim().length === 0) {
      return [];
    }
    return readThrough(
      cacheKey(['search', query.trim().toLowerCase(), region]),
      TTL.row,
      async () => {
        const [imageConfig, raw] = await Promise.all([
          getConfiguration(),
          request<RawDiscover>('/search/movie', {
            query: query.trim(),
            region,
            include_adult: false,
            language: 'en-US',
            page: 1,
          }),
        ]);
        return (raw.results ?? []).map((movie) =>
          mapMovieSummary(movie, imageConfig),
        );
      },
      {persist: false},
    );
  }

  async function getRecommendations(
    id: number,
    region: string,
  ): Promise<MovieSummary[]> {
    return readThrough(
      cacheKey(['recommendations', id, region]),
      TTL.row,
      async () => {
        const [imageConfig, raw] = await Promise.all([
          getConfiguration(),
          request<RawDiscover>(`/movie/${id}/recommendations`, {
            region,
            language: 'en-US',
            page: 1,
          }),
        ]);
        return (raw.results ?? []).map((movie) =>
          mapMovieSummary(movie, imageConfig),
        );
      },
      {persist: true},
    );
  }

  return {
    getConfiguration,
    getProviders,
    getTrending,
    getOnServices,
    getDiscoverPool,
    getMovie,
    searchMovies,
    getRecommendations,
  };
}

/** Singleton used by the app. No credential = every call fails with 'config'. */
export const tmdb: TmdbClient =
  config.tmdbAccessToken || config.tmdbApiKey
    ? createTmdbClient({
        apiKey: config.tmdbApiKey,
        accessToken: config.tmdbAccessToken,
      })
    : {
        getConfiguration: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        getProviders: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        getTrending: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        getOnServices: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        getDiscoverPool: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        getMovie: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        searchMovies: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
        getRecommendations: async () => {
          throw new TmdbError('config', 'TMDB is not configured');
        },
      };
