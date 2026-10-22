import {CATALOG, GENRE_LABELS, MOOD_LABELS} from '../data/catalog';
import {
  EraId,
  GenreId,
  Intensity,
  Recommendation,
  RecommendationFilters,
  RecommendationResult,
  Title,
  eraMatches,
} from '../types';

/**
 * Scoring weights live here so they can be tuned and tested in one place.
 * Weights are deliberately simple and deterministic: no ML, no randomness.
 */
export const WEIGHTS = {
  moodTag: 30,
  genre: 20,
  intensity: 10,
  era: 8,
  ratingMultiplier: 2,
  /** Kept visible but ranked lower when runtime is unknown. */
  unknownRuntimePenalty: 5,
} as const;

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 6;

const INTENSITY_RANK: Record<Intensity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** Short, human labels reused by the "why this fits" line. */
const INTENSITY_REASON: Record<Intensity, string> = {
  low: 'Gentle watch',
  medium: 'Some edge',
  high: 'Intense watch',
};

const ERA_REASON: Record<EraId, string> = {
  '2020s': 'From the 2020s',
  '2010s': 'From the 2010s',
  '2000s': 'From the 2000s',
  '1990s': 'From the 1990s',
  earlier: 'A pre-1990 classic',
};

/**
 * Unknown-runtime rule ("permissive-unknown"):
 * a title whose runtime is null is KEPT when a runtime filter is active, but
 * it is penalised in scoring and sorted below known-runtime matches. We never
 * silently drop or invent data.
 */
export function passesStrictFilters(
  title: Title,
  filters: Required<Pick<RecommendationFilters, 'mood'>> & RecommendationFilters,
): boolean {
  if (filters.maxRuntimeMinutes != null) {
    if (title.runtime != null && title.runtime > filters.maxRuntimeMinutes) {
      return false;
    }
  }

  if (filters.genre && !title.genres.includes(filters.genre)) {
    return false;
  }

  if (filters.maxIntensity) {
    if (INTENSITY_RANK[title.intensity] > INTENSITY_RANK[filters.maxIntensity]) {
      return false;
    }
  }

  if (filters.era && !eraMatches(title, filters.era)) {
    return false;
  }

  return true;
}

export function scoreTitle(title: Title, filters: RecommendationFilters): number {
  let score = 0;

  if (title.moods.includes(filters.mood)) {
    score += WEIGHTS.moodTag;
  }

  if (filters.genre && title.genres.includes(filters.genre)) {
    score += WEIGHTS.genre;
  }

  if (filters.maxIntensity) {
    if (
      INTENSITY_RANK[title.intensity] <= INTENSITY_RANK[filters.maxIntensity]
    ) {
      score += WEIGHTS.intensity;
    }
  }

  if (filters.era && eraMatches(title, filters.era)) {
    score += WEIGHTS.era;
  }

  if (title.rating != null) {
    score += title.rating * WEIGHTS.ratingMultiplier;
  }

  if (title.runtime == null) {
    score -= WEIGHTS.unknownRuntimePenalty;
  }

  return score;
}

/**
 * Deterministic ordering: score desc, then rating (known ahead of unknown),
 * then newer year, then id. Identical queries always produce identical lists,
 * which keeps demos and screenshots reproducible.
 */
function compareRecommendations(a: Recommendation, b: Recommendation): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const aRating = a.title.rating;
  const bRating = b.title.rating;
  if (aRating !== bRating) {
    if (aRating == null) {
      return 1;
    }
    if (bRating == null) {
      return -1;
    }
    return bRating - aRating;
  }

  if (a.title.year !== b.title.year) {
    return b.title.year - a.title.year;
  }

  return a.title.id.localeCompare(b.title.id);
}

export function buildReason(title: Title, filters: RecommendationFilters): string {
  const parts: string[] = [];

  if (title.moods.includes(filters.mood)) {
    parts.push(`${MOOD_LABELS[filters.mood]} mood match`);
  }

  if (filters.genre && title.genres.includes(filters.genre)) {
    parts.push(`${GENRE_LABELS[filters.genre]}`);
  }

  parts.push(INTENSITY_REASON[title.intensity]);

  if (filters.era && eraMatches(title, filters.era)) {
    parts.push(ERA_REASON[filters.era]);
  }

  if (title.runtime == null) {
    parts.push('runtime not logged');
  }

  return parts.join(' • ');
}

function rank(titles: Title[], filters: RecommendationFilters): Recommendation[] {
  return titles
    .map((title) => ({
      title,
      score: scoreTitle(title, filters),
      reason: buildReason(title, filters),
    }))
    .sort(compareRecommendations);
}

/**
 * Filter, score, rank, and explain. If strict filters yield nothing we relax
 * constraints one at a time (intensity, then genre, then runtime) so the UI can
 * always show something and say what it loosened. Mood is the last thing to go.
 */
export function recommend(
  filters: RecommendationFilters,
  catalog: Title[] = CATALOG,
): RecommendationResult {
  const limit = Math.min(
    Math.max(1, filters.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  const relaxedConstraints: string[] = [];

  const rankWith = (candidateFilters: RecommendationFilters) =>
    rank(
      catalog.filter((title) => passesStrictFilters(title, candidateFilters)),
      filters,
    );

  let ranked = rankWith(filters);

  if (ranked.length === 0 && filters.maxIntensity) {
    filters = {...filters, maxIntensity: null};
    relaxedConstraints.push('intensity');
    ranked = rankWith(filters);
  }

  if (ranked.length === 0 && filters.genre) {
    filters = {...filters, genre: null};
    relaxedConstraints.push('genre');
    ranked = rankWith(filters);
  }

  if (ranked.length === 0 && filters.era) {
    filters = {...filters, era: null};
    relaxedConstraints.push('era');
    ranked = rankWith(filters);
  }

  if (ranked.length === 0 && filters.maxRuntimeMinutes != null) {
    filters = {...filters, maxRuntimeMinutes: null};
    relaxedConstraints.push('runtime');
    ranked = rankWith(filters);
  }

  if (ranked.length === 0) {
    // Final safety net: never render a blank screen. Rank the whole catalog
    // for the chosen mood, then for sanity across all titles.
    const moodMatches = catalog.filter((title) =>
      title.moods.includes(filters.mood),
    );
    ranked = rank(moodMatches.length > 0 ? moodMatches : catalog, filters);
    relaxedConstraints.push('mood');
  }

  return {
    results: ranked.slice(0, limit),
    wasRelaxed: relaxedConstraints.length > 0,
    relaxedConstraints,
  };
}

export function getTitle(id: string): Title | undefined {
  return CATALOG.find((title) => title.id === id);
}

export function isValidGenre(value: string | null | undefined): value is GenreId {
  if (!value) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(GENRE_LABELS, value);
}
