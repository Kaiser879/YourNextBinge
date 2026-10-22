/**
 * Domain types for Your Next Binge.
 *
 * The app is fully offline: every title lives in the bundled catalog and all
 * filtering/ranking happens locally. There is no API, no network call, and no
 * async data loading.
 */

export type MoodId =
  | 'cozy'
  | 'funny'
  | 'mind-bending'
  | 'thrilling'
  | 'comfort-watch'
  | 'romantic'
  | 'thought-provoking';

export type GenreId =
  | 'comedy'
  | 'drama'
  | 'mystery'
  | 'scifi'
  | 'thriller'
  | 'romance'
  | 'documentary'
  | 'animation';

export type Intensity = 'low' | 'medium' | 'high';

/** Era buckets used as an optional refinement. */
export type EraId = '2020s' | '2010s' | '2000s' | '1990s' | 'earlier';

/** Short, human label for each era bucket (single source, used by UI). */
export const ERA_LABELS: Record<EraId, string> = {
  '2020s': '2020s',
  '2010s': '2010s',
  '2000s': '2000s',
  '1990s': '1990s',
  earlier: '1980s & older',
};

export function eraMatches(title: Title, era: EraId | null | undefined): boolean {
  if (era == null) {
    return true;
  }
  switch (era) {
    case '2020s':
      return title.year >= 2020;
    case '2010s':
      return title.year >= 2010 && title.year <= 2019;
    case '2000s':
      return title.year >= 2000 && title.year <= 2009;
    case '1990s':
      return title.year >= 1990 && title.year <= 1999;
    case 'earlier':
      return title.year < 1990;
  }
}

export interface Title {
  /** Stable internal id, never shown to the user. */
  id: string;
  title: string;
  year: number;
  /** Minutes. null means "not known" — never invented. */
  runtime: number | null;
  genres: GenreId[];
  moods: MoodId[];
  intensity: Intensity;
  /** Original synopsis written for this project. No third-party copy. */
  synopsis: string;
  /** 0-10, only when reliably sourced; null otherwise. */
  rating: number | null;
}

export interface RecommendationFilters {
  mood: MoodId;
  genre?: GenreId | null;
  maxRuntimeMinutes?: number | null;
  maxIntensity?: Intensity | null;
  /** Optional decade preference; strictly filtered, with its own relax step. */
  era?: EraId | null;
  /** Defaults to 5, hard-capped at 6. */
  limit?: number;
}

export interface Recommendation {
  title: Title;
  score: number;
  /** One-line "why this fits" string shown in the UI. */
  reason: string;
}

export interface RecommendationResult {
  results: Recommendation[];
  /** True when strict filters produced nothing and constraints were loosened. */
  wasRelaxed: boolean;
  /** Human-readable list of what was loosened, for the UI banner. */
  relaxedConstraints: string[];
}

export interface MoodOption {
  id: MoodId;
  label: string;
  blurb: string;
}

export interface GenreOption {
  id: GenreId;
  label: string;
}

/**
 * A curated collection is a named, editorially-described shortcut that jumps
 * straight to ranked results. Filters here are presets, not new logic —
 * recommend() evaluates them exactly like hand-picked filters.
 */
export interface CuratedCollection {
  id: string;
  name: string;
  blurb: string;
  filters: Required<
    Pick<
      RecommendationFilters,
      'mood' | 'genre' | 'maxRuntimeMinutes' | 'maxIntensity' | 'era'
    >
  >;
}
