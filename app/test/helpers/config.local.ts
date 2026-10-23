/**
 * Jest stand-in for `src/config.local.ts`.
 *
 * Tests must not depend on the developer's real TMDB credential. Offline-mode
 * tests use these empty values; live-mode tests pass `configured: true` and a
 * fake TMDB client explicitly.
 */
export const TMDB_API_KEY = '';
export const TMDB_ACCESS_TOKEN = '';
export const EMBED_BASE_URL = 'http://10.0.2.2:8000';
