import {TmdbClient} from '../../src/services/tmdb';
import {Movie, MovieSummary, Provider} from '../../src/types.live';

export function movieSummary(
  overrides: Partial<MovieSummary> & {id: number; title: string},
): MovieSummary {
  return {
    year: 2024,
    rating: 7.5,
    voteCount: 100,
    overview: 'A film.',
    posterUrl: `https://image.tmdb.org/t/p/w342/${overrides.id}.jpg`,
    backdropUrl: `https://image.tmdb.org/t/p/w780/${overrides.id}.jpg`,
    genreIds: [35],
    providerLabel: null,
    availability: [],
    ...overrides,
  };
}

export function movieDetail(
  overrides: Partial<Movie> & {id: number; title: string},
): Movie {
  return {
    ...movieSummary(overrides),
    runtime: 108,
    genres: ['Comedy', 'Drama'],
    trailerKey: null,
    region: 'IN',
    availability: [],
    ...overrides,
  };
}

export const prime: Provider = {
  id: 1,
  name: 'Prime Video',
  logoPath: null,
  displayPriority: 1,
};

export const netflix: Provider = {
  id: 2,
  name: 'Netflix',
  logoPath: null,
  displayPriority: 2,
};

export function createFakeTmdb(overrides: Partial<TmdbClient> = {}): TmdbClient {
  return {
    getConfiguration: async () => ({
      baseUrl: 'https://image.tmdb.org/t/p/',
      posterSize: 'w342',
      backdropSize: 'w780',
    }),
    getProviders: async () => [prime, netflix],
    getTrending: async () => [movieSummary({id: 10, title: 'Trending Film'})],
    getOnServices: async () => [movieSummary({id: 11, title: 'Service Film'})],
    getDiscoverPool: async () => [],
    getMovie: async (id: number) =>
      movieDetail({
        id,
        title: id === 10 ? 'Trending Film' : 'Service Film',
        availability: [
          {providerId: 1, providerName: 'Prime Video', type: 'flatrate'},
        ],
        providerLabel: 'Prime Video',
      }),
    searchMovies: async () => [],
    getRecommendations: async () => [],
    ...overrides,
  };
}
