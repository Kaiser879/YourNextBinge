import {EMBED_BASE_URL, TMDB_ACCESS_TOKEN, TMDB_API_KEY} from './config.local';

/** The demo is India-only; every data call still takes a region parameter. */
export const DEFAULT_REGION = 'IN';

const apiKey = TMDB_API_KEY.trim();
const accessToken = TMDB_ACCESS_TOKEN.trim();

/** A v3 key or a v4 bearer token both count as configured. */
export const isTmdbConfigured = apiKey.length > 0 || accessToken.length > 0;

export const config = {
  tmdbApiKey: apiKey,
  tmdbAccessToken: accessToken,
  embedBaseUrl: EMBED_BASE_URL.replace(/\/+$/, ''),
} as const;

/** TMDB's public image host is stable; used if /configuration fails. */
export const FALLBACK_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export const IMAGE_SIZES = {
  poster: 'w342',
  backdrop: 'w780',
} as const;
