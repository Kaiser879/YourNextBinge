/**
 * Bundled document vectors + on-device cosine search.
 *
 * The query is encoded by the laptop-local server; the corpus lives in the
 * bundle. Nothing here talks to the network.
 */
import rawIndex from '../data/embedding-index.json';
import {bytesToFloat32, decodeBase64} from './base64';

export interface EmbeddingDoc {
  id: number;
  title: string;
  year: number | null;
  provider: string | null;
}

export interface EmbeddingIndex {
  dim: number;
  model: string;
  ids: Int32Array;
  titles: string[];
  years: Int16Array;
  providerNames: Array<string | null>;
  vectorCount: number;
  vectors: Float32Array;
}

interface RawIndex {
  schema?: number;
  model?: string;
  dim?: number;
  count?: number;
  normalized?: boolean;
  vectors?: string;
  docs?: Array<{
    id?: unknown;
    title?: unknown;
    year?: unknown;
    provider?: unknown;
  }>;
}

let cached: EmbeddingIndex | null | undefined;

function normalizeRow(
  vectors: Float32Array,
  row: number,
  dim: number,
): void {
  const offset = row * dim;
  let norm = 0;
  for (let i = 0; i < dim; i += 1) {
    const value = vectors[offset + i];
    norm += value * value;
  }
  if (!Number.isFinite(norm) || norm <= 0) {
    return;
  }
  const scale = 1 / Math.sqrt(norm);
  for (let i = 0; i < dim; i += 1) {
    vectors[offset + i] *= scale;
  }
}

function parseIndex(raw: RawIndex): EmbeddingIndex | null {
  if (
    raw.schema !== 1 ||
    typeof raw.dim !== 'number' ||
    raw.dim <= 0 ||
    typeof raw.model !== 'string' ||
    typeof raw.vectors !== 'string' ||
    !Array.isArray(raw.docs) ||
    raw.docs.length === 0
  ) {
    return null;
  }

  const docs: EmbeddingDoc[] = [];
  for (const doc of raw.docs) {
    if (
      !doc ||
      typeof doc.id !== 'number' ||
      typeof doc.title !== 'string' ||
      !Number.isFinite(doc.id)
    ) {
      return null;
    }
    docs.push({
      id: doc.id,
      title: doc.title,
      year: typeof doc.year === 'number' ? doc.year : null,
      provider: typeof doc.provider === 'string' ? doc.provider : null,
    });
  }

  const count = raw.count ?? docs.length;
  if (count !== docs.length) {
    return null;
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(raw.vectors);
  } catch {
    return null;
  }
  if (bytes.byteLength !== count * raw.dim * 4) {
    return null;
  }

  const vectors = bytesToFloat32(bytes);
  // The builder normalizes, but normalizing again is cheap and makes a
  // hand-edited or partially-normalized index safe.
  for (let row = 0; row < count; row += 1) {
    normalizeRow(vectors, row, raw.dim);
  }

  return {
    dim: raw.dim,
    model: raw.model,
    ids: Int32Array.from(docs.map((doc) => doc.id)),
    titles: docs.map((doc) => doc.title),
    years: Int16Array.from(docs.map((doc) => doc.year ?? 0)),
    providerNames: docs.map((doc) => doc.provider),
    vectorCount: count,
    vectors,
  };
}

/**
 * Lazily decode the bundled index. Returns null when the index has not been
 * built yet (the builder writes the real one) or is malformed.
 */
export function getEmbeddingIndex(): EmbeddingIndex | null {
  if (cached !== undefined) {
    return cached;
  }
  try {
    cached = parseIndex(rawIndex as RawIndex);
  } catch (error) {
    console.warn('[YNB] embedding index failed to load', error);
    cached = null;
  }
  return cached;
}

/** Test seam: inject an index without touching the bundled JSON. */
export function setEmbeddingIndexForTests(
  index: EmbeddingIndex | null,
): void {
  cached = index;
}

export function resetEmbeddingIndexCache(): void {
  cached = undefined;
}

function normalizeQuery(
  query: Float32Array,
  dim: number,
): Float32Array | null {
  if (query.length !== dim) {
    return null;
  }
  let norm = 0;
  for (let i = 0; i < dim; i += 1) {
    const value = query[i];
    if (!Number.isFinite(value)) {
      return null;
    }
    norm += value * value;
  }
  if (!Number.isFinite(norm) || norm <= 0) {
    return null;
  }
  const scale = 1 / Math.sqrt(norm);
  const output = new Float32Array(dim);
  for (let i = 0; i < dim; i += 1) {
    output[i] = query[i] * scale;
  }
  return output;
}

export interface EmbeddingHit {
  row: number;
  score: number;
}

/**
 * One linear pass over the corpus, keeping the best k in a small sorted array.
 * 1,200 × 384 floats is well under 10 ms in Hermes.
 */
export function cosineTopK(
  query: Float32Array,
  index: EmbeddingIndex,
  k: number,
): EmbeddingHit[] {
  const normalized = normalizeQuery(query, index.dim);
  if (!normalized || k <= 0) {
    return [];
  }

  const best: EmbeddingHit[] = [];
  for (let row = 0; row < index.vectorCount; row += 1) {
    const offset = row * index.dim;
    let score = 0;
    for (let i = 0; i < index.dim; i += 1) {
      score += normalized[i] * index.vectors[offset + i];
    }
    if (!Number.isFinite(score)) {
      continue;
    }
    if (
      best.length === k &&
      score <= best[best.length - 1].score
    ) {
      continue;
    }
    let insertAt = best.length;
    while (insertAt > 0 && best[insertAt - 1].score < score) {
      insertAt -= 1;
    }
    best.splice(insertAt, 0, {row, score});
    if (best.length > k) {
      best.pop();
    }
  }
  return best;
}

export function findRowById(
  index: EmbeddingIndex,
  id: number,
): number {
  return index.ids.indexOf(id);
}

export function moreLikeThis(
  index: EmbeddingIndex,
  movieId: number,
  k: number,
): EmbeddingHit[] {
  const row = findRowById(index, movieId);
  if (row < 0) {
    return [];
  }
  const start = row * index.dim;
  const vector = index.vectors.slice(start, start + index.dim);
  return cosineTopK(vector, index, k + 1)
    .filter((hit) => hit.row !== row)
    .slice(0, k);
}

export function docAt(
  index: EmbeddingIndex,
  row: number,
): EmbeddingDoc | null {
  if (row < 0 || row >= index.vectorCount) {
    return null;
  }
  return {
    id: index.ids[row],
    title: index.titles[row],
    year: index.years[row] === 0 ? null : index.years[row],
    provider: index.providerNames[row],
  };
}
