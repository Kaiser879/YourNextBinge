/**
 * Search orchestration.
 *
 * Order of preference:
 *   1. semantic  — encode the query on the local server, cosine against the
 *                  bundled IN-scoped corpus (zero further network calls);
 *   2. keyword   — TMDB /search/movie, intersected with the IN-scoped index;
 *   3. local     — case-insensitive title search over the bundled index.
 *
 * Every path returns, so the search screen can always explain itself.
 */
import {EmbeddingIndex, cosineTopK, docAt} from './embeddings';
import {embedTexts} from './embedClient';
import {TmdbClient} from './tmdb';
import {Movie, MovieSummary, SearchMode} from '../types.live';

export interface SearchOutcome {
  mode: SearchMode;
  items: MovieSummary[];
  tookMs: number;
}

export interface SearchDeps {
  client: TmdbClient;
  index: EmbeddingIndex | null;
  embed?: typeof embedTexts;
}

function summaryFromRow(
  index: EmbeddingIndex,
  row: number,
): MovieSummary | null {
  const doc = docAt(index, row);
  if (!doc) {
    return null;
  }
  return {
    id: doc.id,
    title: doc.title,
    year: doc.year,
    rating: null,
    voteCount: 0,
    overview: '',
    posterUrl: null,
    backdropUrl: null,
    genreIds: [],
    providerLabel: doc.provider,
    availability: [],
  };
}

function dedupe(items: MovieSummary[], limit: number): MovieSummary[] {
  const seen = new Set<number>();
  const output: MovieSummary[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    output.push(item);
    if (output.length >= limit) {
      break;
    }
  }
  return output;
}

function localTitleSearch(
  query: string,
  index: EmbeddingIndex | null,
  limit: number,
): MovieSummary[] {
  if (!index) {
    return [];
  }
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 1);
  if (tokens.length === 0) {
    return [];
  }
  const matches: Array<{row: number; score: number}> = [];
  for (let row = 0; row < index.vectorCount; row += 1) {
    const title = index.titles[row].toLowerCase();
    let score = 0;
    let matched = true;
    for (const token of tokens) {
      if (title.includes(token)) {
        score += 1;
      } else {
        matched = false;
        break;
      }
    }
    if (matched) {
      matches.push({row, score});
    }
  }
  matches.sort(
    (a, b) =>
      b.score - a.score ||
      index.titles[a.row].localeCompare(index.titles[b.row]),
  );
  return matches
    .map((match) => summaryFromRow(index, match.row))
    .filter((movie): movie is MovieSummary => movie != null)
    .slice(0, limit);
}

async function keywordSearch(
  query: string,
  region: string,
  deps: SearchDeps,
  limit: number,
): Promise<MovieSummary[]> {
  const results = await deps.client.searchMovies(query, region);
  if (deps.index) {
    const allowed = new Set(Array.from(deps.index.ids));
    return dedupe(
      results.filter((movie) => allowed.has(movie.id)),
      limit,
    );
  }
  // No corpus: prove India availability for the top candidates only.
  const candidates = results.slice(0, Math.min(6, limit));
  const checks = await Promise.allSettled(
    candidates.map((movie) => deps.client.getMovie(movie.id, region)),
  );
  return dedupe(
    checks
      .filter(
        (result): result is PromiseFulfilledResult<Movie> =>
          result.status === 'fulfilled' && result.value.availability.length > 0,
      )
      .map((result) => result.value),
    limit,
  );
}

export async function runSearch(
  rawQuery: string,
  region: string,
  deps: SearchDeps,
  limit = 12,
): Promise<SearchOutcome> {
  const query = rawQuery.trim();
  const startedAt = Date.now();
  if (query.length === 0) {
    return {mode: 'local', items: [], tookMs: 0};
  }

  // 1. Semantic.
  if (deps.index) {
    try {
      const embed = deps.embed ?? embedTexts;
      const [vector] = await embed([query]);
      if (vector && vector.length === deps.index.dim) {
        const hits = cosineTopK(vector, deps.index, limit);
        const items = hits
          .map((hit) => summaryFromRow(deps.index as EmbeddingIndex, hit.row))
          .filter((movie): movie is MovieSummary => movie != null);
        if (items.length > 0) {
          return {
            mode: 'semantic',
            items: dedupe(items, limit),
            tookMs: Date.now() - startedAt,
          };
        }
      }
    } catch {
      // Fall through to keyword search; the screen explains the downgrade.
    }
  }

  // 2. Keyword.
  try {
    const items = await keywordSearch(query, region, deps, limit);
    if (items.length > 0) {
      return {
        mode: 'keyword',
        items,
        tookMs: Date.now() - startedAt,
      };
    }
    // An empty keyword result is still worth checking against the local
    // corpus (e.g. the query is a title phrase the API indexes differently).
  } catch {
    // Fall through to local.
  }

  // 3. Local title match over the bundled corpus.
  return {
    mode: 'local',
    items: localTitleSearch(query, deps.index, limit),
    tookMs: Date.now() - startedAt,
  };
}
