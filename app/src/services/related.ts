import {docAt, EmbeddingIndex, moreLikeThis} from './embeddings';
import {TmdbClient} from './tmdb';
import {MovieSummary} from '../types.live';

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

/**
 * "More like this".
 *
 * Embedding neighbours are preferred because the bundled corpus is
 * availability-scoped: every hit is watchable in India. For titles outside
 * the corpus we fall back to TMDB recommendations, intersect with the index
 * when possible, and finally verify availability with detail calls (capped).
 */
export async function getRelatedMovies(opts: {
  movieId: number;
  region: string;
  client: TmdbClient;
  index: EmbeddingIndex | null;
  limit?: number;
}): Promise<MovieSummary[]> {
  const {movieId, region, client, index} = opts;
  const limit = opts.limit ?? 8;

  if (index) {
    const hits = moreLikeThis(index, movieId, limit);
    const results = hits
      .map((hit) => summaryFromRow(index, hit.row))
      .filter((movie): movie is MovieSummary => movie != null)
      .slice(0, limit);
    if (results.length > 0) {
      return results;
    }
  }

  let recommendations: MovieSummary[] = [];
  try {
    recommendations = await client.getRecommendations(movieId, region);
  } catch {
    return [];
  }

  if (index) {
    const availableIds = new Set(Array.from(index.ids));
    const scoped = recommendations.filter((movie) => availableIds.has(movie.id));
    if (scoped.length > 0) {
      return scoped.slice(0, limit);
    }
  }

  // Last resort: prove availability with detail calls, capped to keep the
  // detail screen responsive.
  const candidates = recommendations.slice(0, Math.min(6, limit));
  const checks = await Promise.allSettled(
    candidates.map((movie) => client.getMovie(movie.id, region)),
  );
  return checks
    .filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<TmdbClient['getMovie']>>> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value)
    .filter((movie) => movie.availability.length > 0)
    .slice(0, limit);
}
