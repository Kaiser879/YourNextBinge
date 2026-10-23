import {runSearch} from '../src/services/search';
import {EmbeddingIndex, setEmbeddingIndexForTests} from '../src/services/embeddings';
import {MovieSummary} from '../src/types.live';
import {TmdbClient} from '../src/services/tmdb';

function summary(id: number, title: string): MovieSummary {
  return {
    id,
    title,
    year: 2020,
    rating: null,
    voteCount: 0,
    overview: '',
    posterUrl: null,
    backdropUrl: null,
    genreIds: [],
    providerLabel: null,
    availability: [],
  };
}

function index(): EmbeddingIndex {
  return {
    dim: 2,
    model: 'test',
    ids: Int32Array.from([1, 2, 3]),
    titles: ['Cosy Space Film', 'Heist Comedy', 'Space Heist'],
    years: Int16Array.from([2024, 2023, 2022]),
    providerNames: ['Prime Video', 'Netflix', 'JioHotstar'],
    vectorCount: 3,
    vectors: Float32Array.from([1, 0, 0, 1, 0.8, 0.6]),
  };
}

function fakeClient(overrides: Partial<TmdbClient> = {}): TmdbClient {
  const client = {
    getConfiguration: async () => ({
      baseUrl: 'https://image.tmdb.org/t/p/',
      posterSize: 'w342',
      backdropSize: 'w780',
    }),
    getProviders: async () => [],
    getTrending: async () => [],
    getOnServices: async () => [],
    getDiscoverPool: async () => [],
    getMovie: async (id: number) => ({
      ...summary(id, `Movie ${id}`),
      runtime: 100,
      genres: [],
      trailerKey: null,
      region: 'IN',
      availability: [
        {providerId: 2, providerName: 'Prime Video', type: 'flatrate' as const},
      ],
    }),
    searchMovies: async () => [summary(1, 'Cosy Space Film')],
    getRecommendations: async () => [],
    ...overrides,
  };
  return client;
}

describe('search orchestration', () => {
  beforeEach(() => {
    setEmbeddingIndexForTests(null);
  });

  afterEach(() => {
    setEmbeddingIndexForTests(null);
  });

  it('uses semantic ranking when the embedding server answers', async () => {
    const outcome = await runSearch('cosy space', 'IN', {
      client: fakeClient(),
      index: index(),
      embed: async () => [Float32Array.from([1, 0])],
    });

    expect(outcome.mode).toBe('semantic');
    expect(outcome.items.slice(0, 2).map((movie) => movie.id)).toEqual([1, 3]);
    expect(outcome.items[0].providerLabel).toBe('Prime Video');
  });

  it('falls back to keyword search when embeddings fail', async () => {
    const searchMovies = jest.fn(async () => [
      summary(1, 'Cosy Space Film'),
      summary(99, 'Not in the corpus'),
    ]);

    const outcome = await runSearch('space', 'IN', {
      client: fakeClient({searchMovies}),
      index: index(),
      embed: async () => {
        throw new Error('server down');
      },
    });

    expect(outcome.mode).toBe('keyword');
    expect(outcome.items.map((movie) => movie.id)).toEqual([1]);
    expect(searchMovies).toHaveBeenCalledWith('space', 'IN');
  });

  it('falls back to local title matching when both network paths fail', async () => {
    const outcome = await runSearch('heist', 'IN', {
      client: fakeClient({
        searchMovies: async () => {
          throw new Error('offline');
        },
      }),
      index: index(),
      embed: async () => {
        throw new Error('server down');
      },
    });

    expect(outcome.mode).toBe('local');
    expect(outcome.items.map((movie) => movie.title)).toEqual([
      'Heist Comedy',
      'Space Heist',
    ]);
  });

  it('returns an empty local result rather than throwing when nothing matches', async () => {
    const outcome = await runSearch('zzzz', 'IN', {
      client: fakeClient({
        searchMovies: async () => {
          throw new Error('offline');
        },
      }),
      index: index(),
      embed: async () => {
        throw new Error('server down');
      },
    });
    expect(outcome).toMatchObject({mode: 'local', items: []});
  });

  it('verifies availability when no bundled index exists', async () => {
    const getMovie = jest.fn(async (id: number) => ({
      ...summary(id, `Movie ${id}`),
      runtime: 100,
      genres: [],
      trailerKey: null,
      region: 'IN',
      availability:
        id === 1
          ? [
              {
                providerId: 2,
                providerName: 'Prime Video',
                type: 'flatrate' as const,
              },
            ]
          : [],
    }));

    const outcome = await runSearch('space', 'IN', {
      client: fakeClient({
        searchMovies: async () => [summary(1, 'A'), summary(2, 'B')],
        getMovie,
      }),
      index: null,
    });

    expect(outcome.mode).toBe('keyword');
    expect(outcome.items.map((movie) => movie.id)).toEqual([1]);
    expect(getMovie).toHaveBeenCalledTimes(2);
  });
});
