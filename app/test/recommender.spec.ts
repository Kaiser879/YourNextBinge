import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  WEIGHTS,
  buildReason,
  getTitle,
  recommend,
} from '../src/services/recommender';
import {CATALOG, CURATED_COLLECTIONS, GENRES} from '../src/data/catalog';
import {Title} from '../src/types';

function makeTitle(overrides: Partial<Title> & Pick<Title, 'id'>): Title {
  return {
    title: overrides.id,
    year: 2000,
    runtime: 100,
    genres: ['drama'],
    moods: ['cozy'],
    intensity: 'low',
    synopsis: 'Test synopsis.',
    rating: null,
    ...overrides,
  };
}

describe('recommender', () => {
  it('is deterministic: the same query returns the same ranked list', () => {
    const a = recommend({mood: 'funny', maxRuntimeMinutes: 120, limit: 5});
    const b = recommend({mood: 'funny', maxRuntimeMinutes: 120, limit: 5});

    expect(a).toEqual(b);
    expect(a.results.map((r) => r.title.id)).toEqual(
      b.results.map((r) => r.title.id),
    );
  });

  it('excludes titles that exceed the runtime filter', () => {
    const catalog = [
      makeTitle({id: 'short', runtime: 90}),
      makeTitle({id: 'long', runtime: 150}),
    ];

    const result = recommend({mood: 'cozy', maxRuntimeMinutes: 120}, catalog);

    expect(result.results.map((r) => r.title.id)).toEqual(['short']);
  });

  it('keeps unknown-runtime titles (permissive-unknown) and ranks them lower', () => {
    const catalog = [
      makeTitle({id: 'known', runtime: 90}),
      makeTitle({id: 'unknown', runtime: null}),
    ];

    const result = recommend({mood: 'cozy', maxRuntimeMinutes: 120}, catalog);

    expect(result.results.map((r) => r.title.id)).toEqual(['known', 'unknown']);
    expect(result.results[1].title.runtime).toBeNull();
  });

  it('applies the genre filter strictly when a genre is selected', () => {
    const catalog = [
      makeTitle({id: 'mystery', genres: ['mystery']}),
      makeTitle({id: 'comedy', genres: ['comedy']}),
    ];

    const result = recommend({mood: 'cozy', genre: 'mystery'}, catalog);

    expect(result.results.map((r) => r.title.id)).toEqual(['mystery']);
    expect(result.wasRelaxed).toBe(false);
  });

  it('relaxes filters instead of returning an empty list', () => {
    // The shortest title in the catalog is 30 min; nothing is 20 min or less,
    // so genre and runtime must both relax rather than return a blank screen.
    const result = recommend({
      mood: 'romantic',
      genre: 'documentary',
      maxRuntimeMinutes: 20,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.wasRelaxed).toBe(true);
    expect(result.relaxedConstraints).toContain('genre');
    expect(result.relaxedConstraints).toContain('runtime');
  });

  it('breaks ties deterministically by rating, then year, then id', () => {
    const catalog = [
      makeTitle({id: 'b-old-lower', year: 2001, rating: 7}),
      makeTitle({id: 'a-new-higher', year: 2010, rating: 8}),
      makeTitle({id: 'c-old-ratingless', year: 1999, rating: null}),
    ];

    const result = recommend({mood: 'cozy'}, catalog);

    expect(result.results.map((r) => r.title.id)).toEqual([
      'a-new-higher',
      'b-old-lower',
      'c-old-ratingless',
    ]);
  });

  it('builds an explanation that names the matched mood and genre', () => {
    const title = getTitle('knives-out');
    expect(title).toBeDefined();

    const reason = buildReason(title as Title, {
      mood: 'cozy',
      genre: 'mystery',
    });

    expect(reason).toContain('Cozy');
    expect(reason).toContain('Mystery');
    expect(reason).toContain('Some edge');
  });

  it('never returns more than the safe maximum', () => {
    const tooMany = recommend({mood: 'cozy', limit: 50});
    expect(tooMany.results.length).toBeLessThanOrEqual(MAX_LIMIT);
    expect(tooMany.results.length).toBe(MAX_LIMIT);

    const byDefault = recommend({mood: 'cozy'});
    expect(byDefault.results.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
  });

  it('keeps scoring weights centralised and numeric', () => {
    expect(WEIGHTS.moodTag).toBeGreaterThan(WEIGHTS.genre);
    expect(WEIGHTS.genre).toBeGreaterThan(WEIGHTS.intensity);
    expect(WEIGHTS.intensity).toBeGreaterThan(WEIGHTS.era);
    expect(WEIGHTS.era).toBeGreaterThan(0);
    expect(WEIGHTS.unknownRuntimePenalty).toBeGreaterThan(0);
  });

  it('has a catalogue where every mood yields at least one match', () => {
    const moods = CATALOG.flatMap((title) => title.moods);
    const uniqueMoods = Array.from(new Set(moods));

    expect(uniqueMoods.length).toBe(7);
    uniqueMoods.forEach((mood) => {
      const result = recommend({mood, limit: 1});
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.wasRelaxed).toBe(false);
    });
  });

  it('ships the full curated catalogue of 83 unique titles', () => {
    expect(CATALOG.length).toBe(83);
    expect(new Set(CATALOG.map((title) => title.id)).size).toBe(CATALOG.length);
  });

  it('covers every genre with at least one title', () => {
    GENRES.forEach((genre) => {
      const matches = CATALOG.filter((title) =>
        title.genres.includes(genre.id),
      );
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('covers every decade bucket so era filters always find something', () => {
    const eras: Array<['2020s' | '2010s' | '2000s' | '1990s' | 'earlier', (year: number) => boolean]> = [
      ['2020s', (y) => y >= 2020],
      ['2010s', (y) => y >= 2010 && y <= 2019],
      ['2000s', (y) => y >= 2000 && y <= 2009],
      ['1990s', (y) => y >= 1990 && y <= 1999],
      ['earlier', (y) => y < 1990],
    ];

    eras.forEach(([_era, inBucket]) => {
      const matches = CATALOG.filter((title) => inBucket(title.year));
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('applies the era filter strictly when an era is selected', () => {
    const result = recommend({mood: 'funny', era: 'earlier', limit: 6});
    expect(result.results.length).toBeGreaterThan(0);
    result.results.forEach((entry) => {
      expect(entry.title.year).toBeLessThan(1990);
    });
  });

  it('relaxes the era preference before the runtime cap', () => {
    // Nothing at all fits a 20-minute cap, so both era and runtime must relax
    // in ladder order: intensity, genre, era, runtime, mood.
    const result = recommend({
      mood: 'mind-bending',
      era: '1990s',
      maxRuntimeMinutes: 20,
    });

    expect(result.wasRelaxed).toBe(true);
    const eraIndex = result.relaxedConstraints.indexOf('era');
    const runtimeIndex = result.relaxedConstraints.indexOf('runtime');

    // Era is either relaxed alongside runtime or before it — never after.
    expect(eraIndex).toBeGreaterThanOrEqual(0);
    expect(eraIndex).toBeLessThan(runtimeIndex);
  });

  it('names the era in the why-this-fits line when it matched', () => {
    const result = recommend({mood: 'cozy', era: '2000s', limit: 1});
    expect(result.results[0].reason).toContain('From the 2000s');
  });
});

describe('curated collections', () => {
  it('are uniquely identified and carry full filter presets', () => {
    expect(CURATED_COLLECTIONS.length).toBeGreaterThanOrEqual(4);
    const ids = CURATED_COLLECTIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    CURATED_COLLECTIONS.forEach((collection) => {
      expect(collection.name.length).toBeGreaterThan(0);
      expect(collection.blurb.length).toBeGreaterThan(0);
      expect(collection.filters.mood).toBeDefined();
      expect(collection.filters).toHaveProperty('genre');
      expect(collection.filters).toHaveProperty('era');
    });
  });

  it('return exact-match results for every collection preset with no relaxation', () => {
    CURATED_COLLECTIONS.forEach((collection) => {
      const result = recommend(collection.filters);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.wasRelaxed).toBe(false);
    });
  });

  it('rank a title carrying the preset mood into every collection list', () => {
    CURATED_COLLECTIONS.forEach((collection) => {
      const result = recommend({...collection.filters, limit: MAX_LIMIT});
      const moodCarriers = result.results.filter((entry) =>
        entry.title.moods.includes(collection.filters.mood),
      );
      expect(moodCarriers.length).toBeGreaterThan(0);
    });
  });
});
