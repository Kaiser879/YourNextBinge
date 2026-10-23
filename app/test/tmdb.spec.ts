import {
  buildQuery,
  createTmdbClient,
  mapAvailability,
  mapMovieSummary,
  pickTrailerKey,
  TmdbError,
} from '../src/services/tmdb';
import {clearMemoryCache} from '../src/services/tmdbCache';
import {setStorageBackend} from '../src/services/storage';
import {createMemoryStorage} from './helpers/memoryStorage';

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function response(body: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const configuration = {
  images: {secure_base_url: 'https://image.tmdb.org/t/p/'},
};

const discover = {
  page: 1,
  total_pages: 10,
  results: [
    {
      id: 1,
      title: 'Popular One',
      release_date: '2024-05-01',
      vote_average: 7.25,
      vote_count: 100,
      overview: 'A popular film.',
      poster_path: '/poster.jpg',
      backdrop_path: '/back.jpg',
      genre_ids: [35, 18],
    },
  ],
};

const detail = {
  id: 1,
  title: 'Popular One',
  release_date: '2024-05-01',
  vote_average: 7.25,
  vote_count: 100,
  overview: 'A popular film.',
  poster_path: '/poster.jpg',
  backdrop_path: '/back.jpg',
  runtime: 112,
  genres: [
    {id: 35, name: 'Comedy'},
    {id: 18, name: 'Drama'},
  ],
  videos: {
    results: [
      {key: 'teaser', site: 'YouTube', type: 'Teaser', official: false},
      {key: 'trailer', site: 'YouTube', type: 'Trailer', official: true},
      {key: 'vimeo', site: 'Vimeo', type: 'Trailer', official: true},
    ],
  },
  'watch/providers': {
    results: {
      IN: {
        flatrate: [
          {provider_id: 2, provider_name: 'Prime Video', display_priority: 1},
        ],
        rent: [{provider_id: 4, provider_name: 'Apple TV', display_priority: 2}],
        buy: [{provider_id: 5, provider_name: 'Google Play', display_priority: 3}],
      },
    },
  },
};

function fakeFetch() {
  return jest.fn(
    async (
      url: string,
      _init?: {headers?: Record<string, string>},
    ) => {
    if (url.includes('/configuration')) {
      return response(configuration);
    }
    if (url.includes('/watch/providers/movie')) {
      return response({
        results: [
          {provider_id: 2, provider_name: 'Prime Video', display_priority: 1},
          {provider_id: 4, provider_name: 'Apple TV', display_priority: 2},
        ],
      });
    }
    if (url.includes('/discover/movie')) {
      return response(discover);
    }
    if (url.includes('/search/movie')) {
      return response(discover);
    }
    if (url.includes('/recommendations')) {
      return response(discover);
    }
    if (url.includes('/movie/1')) {
      return response(detail);
    }
    return response({status_code: 34, status_message: 'Not found'}, 404);
  });
}

describe('tmdb', () => {
  beforeEach(() => {
    setStorageBackend(createMemoryStorage());
    clearMemoryCache();
  });

  afterAll(() => {
    setStorageBackend(null);
  });

  it('builds an encoded query string and skips empty values', () => {
    expect(
      buildQuery({
        region: 'IN',
        query: 'cosy & warm',
        page: 1,
        nothing: null,
        blank: '',
      }),
    ).toBe('region=IN&query=cosy%20%26%20warm&page=1');
  });

  it('maps summary fields and image URLs', () => {
    const summary = mapMovieSummary(
      discover.results[0],
      {baseUrl: 'https://image.tmdb.org/t/p/', posterSize: 'w342', backdropSize: 'w780'},
      'Prime Video',
    );
    expect(summary).toMatchObject({
      id: 1,
      title: 'Popular One',
      year: 2024,
      rating: 7.3,
      providerLabel: 'Prime Video',
      posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w780/back.jpg',
      genreIds: [35, 18],
    });
  });

  it('hides unrated titles and keeps a real rating', () => {
    expect(
      mapMovieSummary({id: 2, title: 'Unrated', vote_average: 0, vote_count: 0})
        .rating,
    ).toBeNull();
  });

  it('maps stream/rent/buy availability', () => {
    expect(mapAvailability(detail['watch/providers'].results.IN)).toEqual([
      {providerId: 2, providerName: 'Prime Video', type: 'flatrate'},
      {providerId: 4, providerName: 'Apple TV', type: 'rent'},
      {providerId: 5, providerName: 'Google Play', type: 'buy'},
    ]);
    expect(mapAvailability(undefined)).toEqual([]);
  });

  it('prefers an official YouTube trailer', () => {
    expect(pickTrailerKey(detail)).toBe('trailer');
    expect(pickTrailerKey({id: 1, videos: {results: []}})).toBeNull();
  });

  it('requests India availability-scoped discover rows', async () => {
    const fetchImpl = fakeFetch();
    const client = createTmdbClient({apiKey: 'key', fetchImpl: fetchImpl as any});

    const items = await client.getTrending('IN');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Popular One');

    const discoverCall = fetchImpl.mock.calls.find(([url]) =>
      url.includes('/discover/movie'),
    );
    expect(discoverCall?.[0]).toContain('watch_region=IN');
    expect(discoverCall?.[0]).toContain(
      'with_watch_monetization_types=flatrate%7Cfree%7Cads%7Crent%7Cbuy',
    );
    expect(discoverCall?.[0]).toContain('sort_by=popularity.desc');
  });

  it('scopes on-my-services rows to the selected provider ids', async () => {
    const fetchImpl = fakeFetch();
    const client = createTmdbClient({apiKey: 'key', fetchImpl: fetchImpl as any});

    await client.getOnServices('IN', [8, 2]);
    const call = fetchImpl.mock.calls.find(([url]) =>
      url.includes('with_watch_providers=2%7C8'),
    );
    expect(call).toBeTruthy();
  });

  it('does not request a row when no services are selected', async () => {
    const fetchImpl = fakeFetch();
    const client = createTmdbClient({apiKey: 'key', fetchImpl: fetchImpl as any});
    expect(await client.getOnServices('IN', [])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps detail availability, runtime, genres, and trailer', async () => {
    const fetchImpl = fakeFetch();
    const client = createTmdbClient({apiKey: 'key', fetchImpl: fetchImpl as any});

    const movie = await client.getMovie(1, 'IN');
    expect(movie).toMatchObject({
      id: 1,
      runtime: 112,
      genres: ['Comedy', 'Drama'],
      trailerKey: 'trailer',
      region: 'IN',
      providerLabel: 'Prime Video',
    });
    expect(movie.availability).toHaveLength(3);
  });

  it('authenticates a v4 read token with a Bearer header', async () => {
    const fetchImpl = fakeFetch();
    const client = createTmdbClient({
      accessToken: 'eyJ.test-token',
      fetchImpl: fetchImpl as any,
    });

    await client.getTrending('IN');

    const call = fetchImpl.mock.calls.find(([url]) =>
      url.includes('/configuration'),
    );
    expect(call?.[0]).not.toContain('api_key');
    expect(call?.[1]?.headers).toEqual({
      Authorization: 'Bearer eyJ.test-token',
    });
  });

  it('requires either a v3 key or a v4 token', () => {
    expect(() => createTmdbClient({})).toThrow(TmdbError);
  });

  it('surfaces HTTP failures as typed errors after one retry', async () => {
    const fetchImpl = jest.fn(async () => response({}, 500));
    const client = createTmdbClient({apiKey: 'key', fetchImpl: fetchImpl as any});

    await expect(client.getConfiguration()).rejects.toBeInstanceOf(TmdbError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
