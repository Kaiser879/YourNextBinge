/**
 * Copy this file to `config.local.ts` (gitignored) and fill in your credential.
 *
 *   npm run setup:config
 *
 * TMDB accepts either:
 *   - a v3 API key (32 characters) -> sent as ?api_key=...
 *   - a v4 read access token (JWT starting with "eyJ") -> sent as a Bearer header
 *
 * Fill in exactly one. The credential ships inside the app bundle; that is
 * acceptable for a demo build, not for a production submission.
 */
export const TMDB_API_KEY = '';
export const TMDB_ACCESS_TOKEN = '';
export const EMBED_BASE_URL = 'http://10.0.2.2:8000';
