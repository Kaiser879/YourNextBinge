import {
  cosineTopK,
  docAt,
  findRowById,
  getEmbeddingIndex,
  moreLikeThis,
  resetEmbeddingIndexCache,
  setEmbeddingIndexForTests,
  EmbeddingIndex,
} from '../src/services/embeddings';

function index(): EmbeddingIndex {
  return {
    dim: 4,
    model: 'test',
    ids: Int32Array.from([10, 20, 30]),
    titles: ['Space Movie', 'Cozy Film', 'Heist Comedy'],
    years: Int16Array.from([2020, 2019, 2021]),
    providerNames: ['Prime Video', null, 'Netflix'],
    vectorCount: 3,
    vectors: Float32Array.from([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0.8, 0.6, 0, 0,
    ]),
  };
}

describe('embeddings', () => {
  afterEach(() => {
    setEmbeddingIndexForTests(null);
    resetEmbeddingIndexCache();
  });

  it('decodes the bundled index', () => {
    resetEmbeddingIndexCache();
    const bundled = getEmbeddingIndex();
    expect(bundled).not.toBeNull();
    expect(bundled?.dim).toBe(384);
    expect(bundled?.vectorCount).toBeGreaterThan(100);
    expect(bundled?.vectors.length).toBe(
      (bundled?.dim ?? 0) * (bundled?.vectorCount ?? 0),
    );
  });

  it('ranks by cosine similarity and keeps the best k', () => {
    const hits = cosineTopK(
      Float32Array.from([1, 0, 0, 0]),
      index(),
      2,
    );
    expect(hits.map((hit) => hit.row)).toEqual([0, 2]);
    expect(hits[0].score).toBeCloseTo(1, 5);
    expect(hits[1].score).toBeCloseTo(0.8, 5);
  });

  it('normalizes an unnormalized query', () => {
    const hits = cosineTopK(
      Float32Array.from([5, 0, 0, 0]),
      index(),
      1,
    );
    expect(hits[0].row).toBe(0);
  });

  it('rejects dimension mismatches and zero vectors', () => {
    expect(cosineTopK(Float32Array.from([1, 0]), index(), 2)).toEqual([]);
    expect(cosineTopK(new Float32Array(4), index(), 2)).toEqual([]);
  });

  it('finds neighbours without returning the source', () => {
    const hits = moreLikeThis(index(), 30, 2);
    expect(hits.map((hit) => hit.row)).toEqual([0, 1]);
    expect(moreLikeThis(index(), 999, 2)).toEqual([]);
  });

  it('exposes document metadata', () => {
    expect(findRowById(index(), 20)).toBe(1);
    expect(docAt(index(), 2)).toMatchObject({
      id: 30,
      title: 'Heist Comedy',
      year: 2021,
      provider: 'Netflix',
    });
    expect(docAt(index(), 99)).toBeNull();
  });
});
